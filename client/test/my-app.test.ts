import { describe, expect, it } from 'bun:test';
import { render } from 'lit';
import '../src/web-awesome';
import { copyTextToClipboard, MyApp } from '../src/components/my-app';
import type { AppState } from '../src/app/app-state';

function createController(state: AppState) {
    return {
        state,
        retry: async () => undefined,
    };
}

describe('MyApp component', () => {
    it('renders the loading state with Web Awesome components', () => {
        const app = new MyApp(
            createController({
                status: 'loading',
                bookId: null,
                bookName: null,
                format: null,
                error: null,
            })
        );
        const container = document.createElement('div');

        render(app.render(), container);

        const SpinnerElement = customElements.get('wa-spinner');
        const spinner = container.querySelector('wa-spinner');

        if (!SpinnerElement) {
            throw new Error('Web Awesome spinner was not registered');
        }

        expect(spinner).toBeInstanceOf(SpinnerElement);
    });

    it('renders the calculator input after Book settings load', () => {
        const app = new MyApp(
            createController({
                status: 'ready',
                bookId: 'book-1',
                bookName: 'Main Book',
                format: {
                    bookId: 'book-1',
                    bookName: 'Main Book',
                    decimalSeparator: 'DOT',
                    fractionDigits: 2,
                },
                error: null,
            })
        );
        const container = document.createElement('div');

        render(app.render(), container);

        const input = container.querySelector('wa-input');

        expect(input).not.toBeNull();
        expect(input?.getAttribute('aria-label')).toBe('Expression');
        expect(container.textContent).not.toContain('Main Book');
        expect(container.textContent).not.toContain('Calculation');
        expect(container.querySelector('h1, h2, h3')).toBeNull();
        expect(input?.getAttribute('hint')).toBeNull();
        expect(container.querySelector('h1')).toBeNull();
        expect(container.textContent).not.toContain('Calculator');
        expect(
            [...container.querySelectorAll('wa-icon')].some(
                icon => icon.getAttribute('name') === 'calculator'
            )
        ).toBe(false);

        const form = container.querySelector('form');
        const buttons = [...container.querySelectorAll('wa-button')];
        const calculateButton = buttons.find(button => button.getAttribute('type') === 'submit');
        const clearButton = buttons.find(button => button.getAttribute('type') === 'button');

        expect(form?.querySelector('.actions')).toBeNull();
        expect(calculateButton?.getAttribute('aria-label')).toBe('Calculate');
        expect(calculateButton?.textContent?.trim()).toBe('');
        expect(clearButton?.getAttribute('aria-label')).toBe('Clear');
        expect(clearButton?.textContent?.trim()).toBe('C');
        expect(container.querySelector('.copy-button')).toBeNull();
    });

    it('opens complete instructions and links to the GitHub repository', async () => {
        const app = new MyApp(
            createController({
                status: 'ready',
                bookId: 'instructions-test-book',
                bookName: 'Main Book',
                format: {
                    bookId: 'instructions-test-book',
                    bookName: 'Main Book',
                    decimalSeparator: 'DOT',
                    fractionDigits: 2,
                },
                error: null,
            })
        );
        document.body.append(app);
        await app.updateComplete;

        const helpButton = app.shadowRoot?.querySelector('.help-button');
        const dialog = app.shadowRoot?.querySelector('.instructions-dialog') as
            (HTMLElement & { open: boolean }) | null;
        const githubButton = dialog?.querySelector('wa-button[href]');

        expect(helpButton?.getAttribute('aria-label')).toBe('Open calculator instructions');
        expect(dialog?.getAttribute('label')).toBe('Instructions');
        expect(dialog?.hasAttribute('light-dismiss')).toBe(true);
        expect(dialog?.querySelector('.instructions-content')).not.toBeNull();
        const dialogText = dialog?.textContent?.replace(/\s+/g, ' ') ?? '';
        expect(dialogText).toContain('Enter or = to calculate');
        expect(dialogText).toContain('+');
        expect(dialogText).toContain('Book-specific decimal separator');
        expect(dialogText).toContain('per Book');
        const instructionNotes = dialog?.querySelectorAll('.instruction-notes > li');
        expect(instructionNotes).toHaveLength(4);
        expect(instructionNotes?.[1]?.querySelectorAll('.instruction-line')).toHaveLength(2);
        expect(instructionNotes?.[2]?.querySelectorAll('.instruction-line')).toHaveLength(2);
        expect(githubButton?.getAttribute('href')).toBe(
            'https://github.com/Jacobvdb/bkper-in-app-calculator'
        );
        expect(githubButton?.getAttribute('target')).toBe('_blank');
        expect(githubButton?.getAttribute('rel')).toBe('noopener noreferrer');

        helpButton?.dispatchEvent(new Event('click', { bubbles: true }));
        await app.updateComplete;

        expect(dialog?.open).toBe(true);
        app.remove();
    });

    it('shows a copy control after calculation and copies the absolute result', async () => {
        let copiedValue: string | null = null;
        Object.defineProperty(window.navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: async (value: string) => {
                    copiedValue = value;
                },
            },
        });

        const app = new MyApp(
            createController({
                status: 'ready',
                bookId: 'copy-test-book',
                bookName: 'Main Book',
                format: {
                    bookId: 'copy-test-book',
                    bookName: 'Main Book',
                    decimalSeparator: 'DOT',
                    fractionDigits: 3,
                },
                error: null,
            })
        );
        document.body.append(app);
        await app.updateComplete;

        const input = app.shadowRoot?.querySelector('wa-input') as
            | (HTMLElement & {
                  value: string;
              })
            | null;
        const form = app.shadowRoot?.querySelector('form');

        if (!input || !form) {
            throw new Error('Calculator form did not render');
        }

        input.value = '458.730 - 496.370';
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await app.updateComplete;

        const copyButton = app.shadowRoot?.querySelector('.copy-button');
        expect(copyButton?.getAttribute('aria-label')).toBe('Copy absolute result');

        copyButton?.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(input.value).toBe('-37.640');
        expect(copiedValue).toBe('37.640');
        app.remove();
        window.sessionStorage.removeItem('bkper-in-app-calculator:copy-test-book');
    });

    it('falls back to document copy when Clipboard API access is blocked', async () => {
        let fallbackValue: string | null = null;
        const originalClipboard = window.navigator.clipboard;
        const originalExecCommand = document.execCommand;

        Object.defineProperty(window.navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: async () => {
                    throw new Error('Clipboard access blocked.');
                },
            },
        });
        Object.defineProperty(document, 'execCommand', {
            configurable: true,
            value: (command: string) => {
                fallbackValue = document.querySelector('textarea')?.value ?? null;
                return command === 'copy';
            },
        });

        await copyTextToClipboard('37.640');

        expect(fallbackValue).toBe('37.640');
        Object.defineProperty(window.navigator, 'clipboard', {
            configurable: true,
            value: originalClipboard,
        });
        Object.defineProperty(document, 'execCommand', {
            configurable: true,
            value: originalExecCommand,
        });
    });

    it('places clear history below the history card', () => {
        window.sessionStorage.setItem(
            'bkper-in-app-calculator:book-1',
            JSON.stringify([{ expression: '1 + 1', result: '2.00' }])
        );

        const app = new MyApp(
            createController({
                status: 'ready',
                bookId: 'book-1',
                bookName: 'Main Book',
                format: {
                    bookId: 'book-1',
                    bookName: 'Main Book',
                    decimalSeparator: 'DOT',
                    fractionDigits: 2,
                },
                error: null,
            })
        );
        const container = document.createElement('div');

        render(app.render(), container);

        const section = container.querySelector('.history-section');
        const children = section ? [...section.children] : [];

        expect(children[0]?.classList.contains('history-card')).toBe(true);
        expect(children[1]?.classList.contains('clear-history-button')).toBe(true);
        window.sessionStorage.removeItem('bkper-in-app-calculator:book-1');
    });
});
