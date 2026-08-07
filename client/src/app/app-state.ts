import type { BookFormat } from '../services/book-service';

export type AppStatus = 'loading' | 'ready' | 'auth-error' | 'book-error' | 'no-book';

export interface AppState {
    status: AppStatus;
    bookId: string | null;
    bookName: string | null;
    format: BookFormat | null;
    error: string | null;
}

export function createInitialAppState(): AppState {
    return {
        status: 'loading',
        bookId: null,
        bookName: null,
        format: null,
        error: null,
    };
}
