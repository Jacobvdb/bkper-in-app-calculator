import { describe, expect, it } from 'bun:test';
import { AppController } from '../src/app/app-controller';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { AuthSession } from '../src/auth/auth-session';
import type { BookFormat, BookService } from '../src/services/book-service';

class TestHost implements ReactiveControllerHost {
    readonly updateComplete = Promise.resolve(true);
    readonly controllers: ReactiveController[] = [];
    updateCount = 0;

    addController(controller: ReactiveController): void {
        this.controllers.push(controller);
    }

    removeController(controller: ReactiveController): void {
        const index = this.controllers.indexOf(controller);
        if (index >= 0) {
            this.controllers.splice(index, 1);
        }
    }

    requestUpdate(): void {
        this.updateCount += 1;
    }
}

function createAuth(overrides: Partial<AuthSession> = {}): AuthSession {
    return {
        authenticatedFetch: async () => new Response(),
        getAccessToken: () => 'token-123',
        init: async () => undefined,
        login: () => undefined,
        refresh: async () => undefined,
        ...overrides,
    };
}

const bookFormat: BookFormat = {
    bookId: 'book-1',
    bookName: 'Main Book',
    decimalSeparator: 'DOT',
    fractionDigits: 2,
};

function createBookService(overrides: Partial<BookService> = {}): BookService {
    return {
        getBookFormat: async () => bookFormat,
        ...overrides,
    };
}

describe('AppController', () => {
    it('shows an authentication error and does not run without authentication', async () => {
        const host = new TestHost();
        let bookLoads = 0;
        const controller = new AppController(host, {
            getSearch: () => '?bookId=book-1',
            createAuthSession: () =>
                createAuth({
                    init: async () => {
                        throw new Error('Login Required.');
                    },
                }),
            createBookService: () =>
                createBookService({
                    getBookFormat: async () => {
                        bookLoads += 1;
                        return bookFormat;
                    },
                }),
        });

        await controller.initialize();

        expect(controller.state.status).toBe('auth-error');
        expect(controller.state.error).toBe('Authentication failed: Login Required.');
        expect(bookLoads).toBe(0);
    });

    it('requires a book context', async () => {
        const host = new TestHost();
        const controller = new AppController(host, {
            getSearch: () => '',
            createAuthSession: () => createAuth(),
            createBookService: () => createBookService(),
        });

        await controller.initialize();

        expect(controller.state.status).toBe('no-book');
        expect(controller.state.error).toBe(
            'No Book context was provided. Open Calculator from a Book’s More menu.'
        );
    });

    it('loads the current Book format after authentication', async () => {
        const host = new TestHost();
        const controller = new AppController(host, {
            getSearch: () => '?bookId=book-1',
            createAuthSession: () => createAuth(),
            createBookService: () => createBookService(),
        });

        await controller.initialize();

        expect(controller.state.status).toBe('ready');
        expect(controller.state.bookId).toBe('book-1');
        expect(controller.state.bookName).toBe('Main Book');
        expect(controller.state.format).toEqual(bookFormat);
    });

    it('exposes a retry for Book-settings failures', async () => {
        const host = new TestHost();
        let attempts = 0;
        const controller = new AppController(host, {
            getSearch: () => '?bookId=book-1',
            createAuthSession: () => createAuth(),
            createBookService: () =>
                createBookService({
                    getBookFormat: async () => {
                        attempts += 1;
                        if (attempts === 1) {
                            throw new Error('Book settings unavailable.');
                        }
                        return bookFormat;
                    },
                }),
        });

        await controller.initialize();
        expect(controller.state.status).toBe('book-error');
        expect(controller.state.error).toBe(
            'Could not load Book settings: Book settings unavailable.'
        );

        await controller.retry();

        expect(controller.state.status).toBe('ready');
        expect(attempts).toBe(2);
    });
});
