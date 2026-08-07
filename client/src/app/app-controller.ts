import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
    createAuthSession,
    type AuthSession,
    type AuthSessionCallbacks,
} from '../auth/auth-session';
import { createBookService, type BookService } from '../services/book-service';
import { createInitialAppState, type AppState } from './app-state';

export interface AppControllerOptions {
    createAuthSession?: (callbacks: AuthSessionCallbacks) => AuthSession;
    createBookService?: (auth: AuthSession) => BookService;
    getSearch?: () => string;
    logger?: Pick<Console, 'error'>;
}

export class AppController implements ReactiveController {
    state: AppState = createInitialAppState();

    private readonly auth: AuthSession;
    private readonly bookService: BookService;
    private readonly getSearch: () => string;
    private readonly logger: Pick<Console, 'error'>;

    constructor(
        private readonly host: ReactiveControllerHost,
        options: AppControllerOptions = {}
    ) {
        this.host.addController(this);
        this.getSearch = options.getSearch ?? (() => window.location.search);
        this.logger = options.logger ?? console;

        const authFactory = options.createAuthSession ?? createAuthSession;
        const bookServiceFactory =
            options.createBookService ?? (auth => createBookService({ auth }));

        this.auth = authFactory({
            onError: error => {
                this.logger.error('Authentication error:', error);
                this.setState({
                    status: 'auth-error',
                    error: `Authentication failed: ${toErrorMessage(error)}`,
                });
            },
        });
        this.bookService = bookServiceFactory(this.auth);
    }

    hostConnected(): void {
        void this.initialize();
    }

    async initialize(): Promise<void> {
        const bookId = getBookIdFromSearch(this.getSearch());
        this.setState({ bookId, status: 'loading', error: null });

        try {
            await this.auth.init();
        } catch (error) {
            this.setAuthenticationError(error);
            return;
        }

        if (this.state.status === 'auth-error') {
            return;
        }

        if (!bookId) {
            this.setState({
                status: 'no-book',
                error: 'No Book context was provided. Open Calculator from a Book’s More menu.',
            });
            return;
        }

        await this.loadBook(bookId);
    }

    async retry(): Promise<void> {
        if (this.state.bookId) {
            await this.loadBook(this.state.bookId);
        }
    }

    private async loadBook(bookId: string): Promise<void> {
        this.setState({ status: 'loading', error: null });

        try {
            const format = await this.bookService.getBookFormat(bookId);
            this.setState({
                status: 'ready',
                bookName: format.bookName,
                format,
                error: null,
            });
        } catch (error) {
            this.logger.error('Book settings error:', error);
            this.setState({
                status: 'book-error',
                error: `Could not load Book settings: ${toErrorMessage(error)}`,
            });
        }
    }

    private setAuthenticationError(error: unknown): void {
        this.logger.error('Authentication error:', error);
        this.setState({
            status: 'auth-error',
            error: `Authentication failed: ${toErrorMessage(error)}`,
        });
    }

    private setState(patch: Partial<AppState>): void {
        this.state = { ...this.state, ...patch };
        this.host.requestUpdate();
    }
}

function getBookIdFromSearch(search: string): string | null {
    return new URLSearchParams(search).get('bookId');
}

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
