import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement } from 'lit/decorators.js';
import {
    evaluateExpression,
    formatAbsoluteAmount,
    normalizeExpression,
} from '../calculator/calculator';
import { createHistoryStore, type HistoryEntry } from '../calculator/history';
import { AppController } from '../app/app-controller';
import type { AppState } from '../app/app-state';

interface CalculatorInputElement extends HTMLElement {
    value: string;
    focus(options?: FocusOptions): void;
}

export interface CalculatorAppController {
    state: AppState;
    retry(): Promise<void>;
}

@customElement('my-app')
export class MyApp extends LitElement {
    static styles = css`
        :host {
            display: block;
            min-height: 100vh;
            box-sizing: border-box;
            padding: var(--bkper-spacing-large);
            background: var(--bkper-color-background);
            color: var(--bkper-color-text);
            font-family: var(--bkper-font-family);
        }

        .calculator-shell {
            width: 100%;
        }

        p {
            margin: 0;
        }

        .empty-history {
            color: var(--bkper-color-neutral);
            font-size: var(--bkper-font-size-small);
            line-height: var(--bkper-line-height-normal);
        }

        .calculation-card,
        .history-card {
            --spacing: var(--bkper-spacing-large);
        }

        .calculation-form {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto auto;
            align-items: center;
            gap: var(--bkper-spacing-small, 0.75rem);
            width: 100%;
        }

        .history-list,
        .status-panel,
        .history-section {
            width: 100%;
        }

        .history-section {
            display: flex;
            flex-direction: column;
        }

        .calculation-form wa-input {
            min-width: 0;
            width: 100%;
        }

        .calculation-form wa-button::part(base) {
            min-width: 4.5rem;
        }

        .clear-history-button {
            align-self: flex-end;
            margin-inline-start: auto;
        }

        .copy-button::part(base) {
            min-width: 3.5rem;
        }

        .history-entry {
            width: 100%;
        }

        .history-entry::part(base) {
            width: 100%;
            justify-content: space-between;
            text-align: start;
        }

        .expression,
        .result {
            font-family: var(--bkper-font-family-code);
        }

        .expression {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .result {
            color: var(--bkper-color-primary);
            font-weight: var(--bkper-font-weight-bold);
            white-space: nowrap;
        }

        .loading-content {
            align-items: center;
            color: var(--bkper-color-neutral);
        }
    `;

    private readonly controller: CalculatorAppController;
    private expression = '';
    private calculationError: string | null = null;
    private hasResult = false;
    private copyValue: string | null = null;
    private historyEntries: HistoryEntry[] = [];
    private historyBookId: string | null = null;
    private historyStore?: ReturnType<typeof createHistoryStore>;
    private focusInputAfterUpdate = false;
    private focusedInitialInput = false;

    constructor(controller?: CalculatorAppController) {
        super();
        this.controller = controller ?? new AppController(this);
    }

    render() {
        const state = this.controller.state;

        if (state.status === 'loading') {
            return this.renderLoading();
        }
        if (state.status === 'auth-error') {
            return this.renderError('Authentication error', state.error, false);
        }
        if (state.status === 'book-error') {
            return this.renderError('Book settings error', state.error, true);
        }
        if (state.status === 'no-book') {
            return this.renderError('No Book context', state.error, false);
        }
        if (!state.format || !state.bookId) {
            return this.renderError('Book settings error', 'Book settings are unavailable.', true);
        }

        this.syncHistory(state.bookId);
        if (!this.focusedInitialInput) {
            this.focusInputAfterUpdate = true;
            this.focusedInitialInput = true;
        }

        return this.renderCalculator();
    }

    protected updated(_changedProperties: PropertyValues): void {
        if (!this.focusInputAfterUpdate) {
            return;
        }

        this.focusInputAfterUpdate = false;
        window.setTimeout(() => {
            const input = this.renderRoot.querySelector(
                'wa-input'
            ) as CalculatorInputElement | null;
            input?.focus();
        }, 0);
    }

    private renderLoading() {
        return html`
            <div class="status-panel wa-stack wa-gap-s" role="status">
                <wa-spinner></wa-spinner>
                <span>Loading Calculator…</span>
            </div>
        `;
    }

    private renderError(title: string, message: string | null, retryable: boolean) {
        return html`
            <div class="status-panel wa-stack wa-gap-s" role="alert">
                <wa-callout variant="danger" appearance="outlined" size="s">
                    <wa-icon slot="icon" name="circle-exclamation"></wa-icon>
                    <strong>${title}</strong><br />
                    ${message ?? 'An unexpected error occurred.'}
                </wa-callout>
                ${
                    retryable
                        ? html`
                              <wa-button variant="brand" @click=${this.handleRetry}>
                                  <wa-icon slot="start" name="rotate-right"></wa-icon>
                                  Retry
                              </wa-button>
                          `
                        : ''
                }
            </div>
        `;
    }

    private renderCalculator() {
        return html`
            <div class="calculator-shell wa-stack wa-gap-l">
                <wa-card class="calculation-card" appearance="outlined">
                    <form class="calculation-form" @submit=${this.handleSubmit}>
                        <wa-input
                            aria-label="Expression"
                            placeholder="3000 - 2000"
                            .value=${this.expression}
                            autofocus
                            autocorrect="off"
                            enterkeyhint="done"
                            inputmode="decimal"
                            spellcheck="false"
                            @input=${this.handleInput}
                            @keydown=${this.handleKeydown}
                        >
                            ${
                                this.hasResult
                                    ? html`
                                          <wa-button
                                              slot="end"
                                              class="copy-button"
                                              type="button"
                                              variant="neutral"
                                              appearance="plain"
                                              aria-label="Copy absolute result"
                                              title="Copy absolute result"
                                              @click=${this.handleCopyResult}
                                          >
                                              <wa-icon name="copy" aria-hidden="true"></wa-icon>
                                          </wa-button>
                                      `
                                    : ''
                            }
                        </wa-input>
                        <wa-button
                            class="calculate-button"
                            type="submit"
                            variant="brand"
                            aria-label="Calculate"
                        >
                            <wa-icon name="equals" aria-hidden="true"></wa-icon>
                        </wa-button>
                        <wa-button
                            class="clear-button"
                            type="button"
                            variant="neutral"
                            appearance="outlined"
                            aria-label="Clear"
                            @click=${this.handleClearInput}
                        >
                            C
                        </wa-button>
                    </form>
                </wa-card>

                ${
                    this.calculationError
                        ? html`
                              <wa-callout variant="danger" appearance="outlined" size="s">
                                  <wa-icon slot="icon" name="circle-exclamation"></wa-icon>
                                  ${this.calculationError}
                              </wa-callout>
                          `
                        : ''
                }
                ${this.renderHistory()}
            </div>
        `;
    }

    private renderHistory() {
        return html`
            <div class="history-section wa-stack wa-gap-xs">
                <wa-card class="history-card" appearance="outlined">
                    ${
                        this.historyEntries.length === 0
                            ? html`<p class="empty-history">Your calculations will appear here.</p>`
                            : html`
                                  <div class="history-list wa-stack wa-gap-xs" role="list">
                                      ${this.historyEntries.map(
                                          entry => html`
                                              <wa-button
                                                  class="history-entry"
                                                  type="button"
                                                  variant="neutral"
                                                  appearance="outlined"
                                                  @click=${() => this.restoreHistory(entry)}
                                              >
                                                  <span class="expression"
                                                      >${entry.expression}</span
                                                  >
                                                  <span class="result">${entry.result}</span>
                                              </wa-button>
                                          `
                                      )}
                                  </div>
                              `
                    }
                </wa-card>
                ${
                    this.historyEntries.length > 0
                        ? html`
                              <wa-button
                                  class="clear-history-button"
                                  type="button"
                                  variant="neutral"
                                  appearance="plain"
                                  size="s"
                                  aria-label="Clear history"
                                  @click=${this.handleClearHistory}
                              >
                                  Clear history
                              </wa-button>
                          `
                        : ''
                }
            </div>
        `;
    }

    private syncHistory(bookId: string): void {
        if (this.historyBookId === bookId && this.historyStore) {
            return;
        }

        this.historyBookId = bookId;
        this.historyStore = createHistoryStore(bookId);
        this.historyEntries = this.historyStore.get();
    }

    private handleInput = (event: Event): void => {
        const input = event.currentTarget as CalculatorInputElement;
        this.expression = input.value;
        this.hasResult = false;
        this.copyValue = null;
        this.calculationError = null;
    };

    private handleKeydown = (event: KeyboardEvent): void => {
        if (!this.hasResult || !startsNewExpression(event.key)) {
            return;
        }

        event.preventDefault();
        this.expression = event.key;
        this.hasResult = false;
        this.copyValue = null;
        this.calculationError = null;
        this.focusInputAfterUpdate = true;
        this.requestUpdate();
    };

    private handleSubmit = (event: Event): void => {
        event.preventDefault();
        this.calculate();
    };

    private calculate(): void {
        const state = this.controller.state;
        if (!state.format || !this.historyStore) {
            return;
        }

        try {
            const calculation = evaluateExpression(this.expression, state.format);
            const entry = {
                expression: normalizeExpression(this.expression, state.format),
                result: calculation.formatted,
            };
            this.historyStore.add(entry);
            this.historyEntries = this.historyStore.get();
            this.expression = calculation.formatted;
            this.hasResult = true;
            this.copyValue = formatAbsoluteAmount(calculation.value, state.format);
            this.calculationError = null;
            this.focusInputAfterUpdate = true;
            this.requestUpdate();
        } catch (error) {
            this.copyValue = null;
            this.calculationError = error instanceof Error ? error.message : String(error);
            this.requestUpdate();
        }
    }

    private handleClearInput = (): void => {
        this.expression = '';
        this.hasResult = false;
        this.copyValue = null;
        this.calculationError = null;
        this.focusInputAfterUpdate = true;
        this.requestUpdate();
    };

    private handleCopyResult = async (): Promise<void> => {
        if (this.copyValue === null) {
            return;
        }

        try {
            await copyTextToClipboard(this.copyValue);
        } catch {
            this.calculationError = 'Could not copy the result.';
            this.requestUpdate();
        }
    };

    private handleClearHistory = (): void => {
        this.historyStore?.clear();
        this.historyEntries = [];
        this.requestUpdate();
    };

    private restoreHistory(entry: HistoryEntry): void {
        this.expression = entry.expression;
        this.hasResult = false;
        this.copyValue = null;
        this.calculationError = null;
        this.focusInputAfterUpdate = true;
        this.requestUpdate();
    }

    private handleRetry = (): void => {
        void this.controller.retry();
    };
}

async function copyTextToClipboard(value: string): Promise<void> {
    if (window.navigator.clipboard?.writeText) {
        await window.navigator.clipboard.writeText(value);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();

    try {
        if (!document.execCommand('copy')) {
            throw new Error('Clipboard copy failed.');
        }
    } finally {
        textarea.remove();
    }
}

function startsNewExpression(key: string): boolean {
    return /[\d.,(]/.test(key);
}

declare global {
    interface HTMLElementTagNameMap {
        'my-app': MyApp;
    }
}
