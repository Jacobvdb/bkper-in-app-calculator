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

        expect(container.querySelector('wa-input')).not.toBeNull();
        expect(container.textContent).toContain('Main Book');
        expect(container.textContent).toContain('History');
    });
});
