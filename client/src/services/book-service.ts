import { Bkper, type Config } from 'bkper-js';
import type { AuthProvider } from '../auth/auth-session';
import type { CalculatorFormat, DecimalSeparator } from '../calculator/calculator';

export interface BookFormat extends CalculatorFormat {
    bookId: string;
    bookName: string;
}

export interface BrowserBkperBook {
    getId(): string;
    getName(): string | undefined;
    getDecimalSeparator(): DecimalSeparator | undefined;
    getFractionDigits(): number | undefined;
}

export interface BrowserBkperClient {
    getBook(bookId: string): Promise<BrowserBkperBook | undefined>;
}

export interface BookService {
    getBookFormat(bookId: string): Promise<BookFormat>;
}

export interface BookServiceOptions {
    auth: AuthProvider;
    bkper?: BrowserBkperClient;
}

export class BookSettingsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BookSettingsError';
    }
}

export function createBkperClientConfig(auth: AuthProvider): Config {
    return {
        oauthTokenProvider: async () => auth.getAccessToken(),
        requestRetryHandler: async (status, _error, attempt) => {
            if (status === 403 && attempt === 1) {
                await auth.refresh();
            }
        },
    };
}

export function createBookService(options: BookServiceOptions): BookService {
    const bkper = options.bkper ?? new Bkper(createBkperClientConfig(options.auth));

    return {
        async getBookFormat(bookId: string): Promise<BookFormat> {
            const book = await bkper.getBook(bookId);
            if (!book) {
                throw new BookSettingsError(`Book “${bookId}” was not found.`);
            }

            const decimalSeparator = book.getDecimalSeparator();
            const fractionDigits = book.getFractionDigits();
            if (decimalSeparator === undefined || fractionDigits === undefined) {
                throw new BookSettingsError('The Book did not provide its number-format settings.');
            }
            if (!Number.isInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 8) {
                throw new BookSettingsError('The Book has invalid fraction-digit settings.');
            }

            return {
                bookId: book.getId() || bookId,
                bookName: book.getName() ?? 'Selected Book',
                decimalSeparator,
                fractionDigits,
            };
        },
    };
}
