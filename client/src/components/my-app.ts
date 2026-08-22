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

const GITHUB_REPOSITORY_URL = 'https://github.com/Jacobvdb/bkper-in-app-calculator';

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
        .history-accordion {
            width: 100%;
        }

        .history-accordion wa-accordion-item {
            --spacing: var(--bkper-spacing-small, 0.75rem);
        }

        .history-accordion wa-accordion-item::part(button) {
            justify-content: flex-end;
        }

        .history-actions {
            display: flex;
            justify-content: flex-end;
            width: 100%;
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

        .copy-tooltip {
            --wa-tooltip-background-color: var(--bkper-color-grey-low);
            --wa-tooltip-border-color: var(--bkper-color-border);
            --wa-tooltip-border-style: solid;
            --wa-tooltip-border-width: 1px;
            --wa-tooltip-content-color: var(--bkper-color-text);
        }

        .history-entry-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: var(--bkper-spacing-x-small, 0.5rem);
            width: 100%;
        }

        .history-entry {
            min-width: 0;
            width: 100%;
        }

        .history-entry::part(base) {
            width: 100%;
            justify-content: space-between;
            text-align: start;
        }

        .history-copy-button::part(base) {
            min-width: 2.75rem;
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

        .support-actions {
            display: flex;
            justify-content: flex-end;
            width: 100%;
        }

        .help-button wa-icon,
        .github-button wa-icon {
            font-size: var(--bkper-font-size-large);
        }

        .instructions-dialog {
            --spacing: var(--bkper-spacing-large);
        }

        .instructions-content {
            display: flex;
            flex-direction: column;
            gap: var(--bkper-spacing-large);
            max-block-size: calc(100vh - (var(--bkper-spacing-large) * 4));
            overflow-y: auto;
            scrollbar-color: var(--bkper-color-neutral) transparent;
            scrollbar-width: thin;
        }

        .instructions-dialog::part(body) {
            scrollbar-color: var(--bkper-color-neutral) transparent;
            scrollbar-width: thin;
        }

        .instruction-list,
        .instruction-notes {
            display: flex;
            flex-direction: column;
            gap: var(--bkper-spacing-large);
        }

        .instruction-notes {
            list-style: none;
            margin: 0;
            padding: 0;
        }

        .instruction-line {
            display: block;
        }

        .instruction-row {
            display: flex;
            align-items: center;
            gap: var(--bkper-spacing-2x-large);
        }

        .instruction-row wa-icon {
            font-size: var(--bkper-font-size-large);
        }

        .dialog-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--bkper-spacing-small);
            width: 100%;
        }
    `;

    private readonly controller: CalculatorAppController;
    private instructionsOpen = false;
    private expression = '';
    private calculationError: string | null = null;
    private hasResult = false;
    private copyValue: string | null = null;
    private copyTooltipOpen = false;
    private copyTooltipTimeout: number | undefined;
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
                    <wa-tooltip
                        class="copy-tooltip"
                        for="calculation-form"
                        trigger="manual"
                        placement="bottom"
                        .open=${this.copyTooltipOpen}
                    >
                        Value Copied
                    </wa-tooltip>
                    <form
                        id="calculation-form"
                        class="calculation-form"
                        @submit=${this.handleSubmit}
                    >
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
                ${this.renderHistory()} ${this.renderSupportActions()}
                ${this.renderInstructionsDialog()}
            </div>
        `;
    }

    private renderSupportActions() {
        return html`
            <div class="support-actions wa-cluster wa-justify-content-end">
                <wa-button
                    class="help-button"
                    type="button"
                    variant="neutral"
                    appearance="plain"
                    size="s"
                    aria-label="Open calculator instructions"
                    title="Instructions"
                    @click=${this.openInstructions}
                >
                    <wa-icon name="circle-question" aria-hidden="true"></wa-icon>
                </wa-button>
            </div>
        `;
    }

    private renderInstructionsDialog() {
        return html`
            <wa-dialog
                class="instructions-dialog"
                label="Instructions"
                light-dismiss
                .open=${this.instructionsOpen}
                @wa-after-hide=${this.handleInstructionsAfterHide}
            >
                <div class="instructions-content wa-stack wa-gap-l">
                    <div class="wa-stack wa-gap-s">
                        <strong>Calculate and copy</strong>
                        <p>
                            Enter an expression and press <strong>Enter</strong> or
                            <strong>=</strong> to calculate it. The absolute result is copied to the
                            clipboard automatically, and <strong>Value Copied</strong> appears when
                            the copy succeeds.
                        </p>
                    </div>

                    <div class="instruction-list wa-stack wa-gap-m">
                        <div class="instruction-row wa-cluster wa-gap-l">
                            <wa-button
                                variant="neutral"
                                appearance="plain"
                                disabled
                                aria-hidden="true"
                                tabindex="-1"
                            >
                                <wa-icon name="copy" aria-hidden="true"></wa-icon>
                            </wa-button>
                            <span>Copies the absolute value of the latest result again.</span>
                        </div>
                        <div class="instruction-row wa-cluster wa-gap-l">
                            <wa-button variant="brand" disabled aria-hidden="true" tabindex="-1">
                                <wa-icon name="equals" aria-hidden="true"></wa-icon>
                            </wa-button>
                            <span>Calculates the value.</span>
                        </div>
                        <div class="instruction-row wa-cluster wa-gap-l">
                            <wa-button
                                variant="neutral"
                                appearance="outlined"
                                disabled
                                aria-hidden="true"
                                tabindex="-1"
                            >
                                C
                            </wa-button>
                            <span>Clears the input.</span>
                        </div>
                    </div>

                    <div class="wa-stack wa-gap-s">
                        <strong>History</strong>
                        <p>
                            Use the chevron to open or close the history. Click a calculation to put
                            that expression back in the input. Click the copy icon next to a history
                            row to copy only that result value.
                        </p>
                    </div>

                    <ul class="instruction-notes">
                        <li>
                            Use <code>+</code>, <code>-</code>, <code>*</code>, <code>/</code>, and
                            parentheses. Multiplication must be explicit with <code>*</code>;
                            implicit multiplication is not accepted.
                        </li>
                        <li>
                            <span class="instruction-line"
                                >Decimal and negative numbers are supported, including shorthand
                                values such as <code>.5</code> and <code>5.</code>.</span
                            >
                            <span class="instruction-line"
                                >Scientific notation is not accepted.</span
                            >
                        </li>
                        <li>
                            <span class="instruction-line"
                                >Results use the Book-specific decimal separator and fraction
                                digits.</span
                            >
                            <span class="instruction-line"
                                >The displayed result does not include thousands grouping.</span
                            >
                        </li>
                        <li>
                            History is kept separately per Book in this browser session, limited to
                            the latest 20 calculations, and is never written to Bkper.
                        </li>
                    </ul>
                </div>
                <div slot="footer" class="dialog-footer wa-cluster wa-justify-content-between">
                    <wa-button
                        href=${GITHUB_REPOSITORY_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="github-button"
                        variant="neutral"
                        appearance="plain"
                        size="s"
                        aria-label="Open GitHub repository"
                        title="Open GitHub repository"
                    >
                        <wa-icon family="brands" name="github" aria-hidden="true"></wa-icon>
                    </wa-button>
                    <wa-button variant="brand" data-dialog="close">Close</wa-button>
                </div>
            </wa-dialog>
        `;
    }

    private renderHistory() {
        return html`
            <wa-accordion
                class="history-accordion"
                appearance="plain"
                heading-level="none"
                icon-placement="end"
                mode="single-collapsible"
            >
                <wa-accordion-item aria-label="History">
                    <div class="history-section wa-stack wa-gap-xs">
                        <wa-card class="history-card" appearance="outlined">
                            ${
                                this.historyEntries.length === 0
                                    ? html`<p class="empty-history">
                                          Your calculations will appear here.
                                      </p>`
                                    : html`
                                          <div class="history-list wa-stack wa-gap-xs" role="list">
                                              ${this.historyEntries.map(
                                                  entry => html`
                                                      <div
                                                          class="history-entry-row"
                                                          role="listitem"
                                                      >
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
                                                              <span class="result"
                                                                  >${entry.result}</span
                                                              >
                                                          </wa-button>
                                                          <wa-button
                                                              class="history-copy-button"
                                                              type="button"
                                                              variant="neutral"
                                                              appearance="outlined"
                                                              aria-label=${`Copy result ${entry.result}`}
                                                              title="Copy result"
                                                              @click=${() =>
                                                                  this.handleCopyHistoryResult(
                                                                      entry
                                                                  )}
                                                          >
                                                              <wa-icon
                                                                  name="copy"
                                                                  aria-hidden="true"
                                                              ></wa-icon>
                                                          </wa-button>
                                                      </div>
                                                  `
                                              )}
                                          </div>
                                      `
                            }
                        </wa-card>
                        ${
                            this.historyEntries.length > 0
                                ? html`
                                      <div
                                          class="history-actions wa-cluster wa-justify-content-end"
                                      >
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
                                      </div>
                                  `
                                : ''
                        }
                    </div>
                </wa-accordion-item>
            </wa-accordion>
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
        this.copyTooltipOpen = false;
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
        this.copyTooltipOpen = false;
        this.calculationError = null;
        this.focusInputAfterUpdate = true;
        this.requestUpdate();
    };

    private handleSubmit = (event: Event): void => {
        event.preventDefault();
        void this.calculate();
    };

    private async calculate(): Promise<void> {
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
            await this.copyResultToClipboard();
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
        this.copyTooltipOpen = false;
        this.calculationError = null;
        this.focusInputAfterUpdate = true;
        this.requestUpdate();
    };

    private handleCopyResult = async (): Promise<void> => {
        await this.copyResultToClipboard();
    };

    private handleCopyHistoryResult = async (entry: HistoryEntry): Promise<void> => {
        await this.copyTextValue(entry.result);
    };

    private async copyResultToClipboard(): Promise<void> {
        if (this.copyValue === null) {
            return;
        }

        await this.copyTextValue(this.copyValue);
    }

    private async copyTextValue(value: string): Promise<void> {
        try {
            await copyTextToClipboard(value);
            this.showCopyTooltip();
        } catch {
            this.calculationError = 'Could not copy the result.';
            this.requestUpdate();
        }
    }

    private showCopyTooltip(): void {
        if (this.copyTooltipTimeout !== undefined) {
            window.clearTimeout(this.copyTooltipTimeout);
        }

        this.copyTooltipOpen = true;
        this.copyTooltipTimeout = window.setTimeout(() => {
            this.copyTooltipOpen = false;
            this.copyTooltipTimeout = undefined;
            this.requestUpdate();
        }, 1500);
        this.requestUpdate();
    }

    private openInstructions = (): void => {
        this.instructionsOpen = true;
        this.requestUpdate();
    };

    private handleInstructionsAfterHide = (): void => {
        this.instructionsOpen = false;
        this.requestUpdate();
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
        this.copyTooltipOpen = false;
        this.calculationError = null;
        this.focusInputAfterUpdate = true;
        this.requestUpdate();
    }

    private handleRetry = (): void => {
        void this.controller.retry();
    };
}

export async function copyTextToClipboard(value: string): Promise<void> {
    if (window.navigator.clipboard?.writeText) {
        try {
            await window.navigator.clipboard.writeText(value);
            return;
        } catch {
            // Embedded apps can expose the API while blocking it with Permissions Policy.
        }
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
