import { describe, expect, it } from 'bun:test';
import { render } from 'lit';
import '../src/web-awesome';
import { MyApp } from '../src/components/my-app';
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
        expect(container.textContent).not.toContain('History');
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
