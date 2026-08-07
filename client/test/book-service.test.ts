import { describe, expect, it } from 'bun:test';
import { createBkperClientConfig, createBookService } from '../src/services/book-service';
import type { BrowserBkperClient } from '../src/services/book-service';

function createAuth() {
    return {
        authenticatedFetch: async () => new Response(),
        getAccessToken: () => 'token-123',
        refresh: async () => undefined,
    };
}

describe('createBookService', () => {
    it('wires token refresh into the bkper-js client config', async () => {
        let refreshCalls = 0;
        const config = createBkperClientConfig({
            authenticatedFetch: async () => new Response(),
            getAccessToken: () => 'token-123',
            refresh: async () => {
                refreshCalls += 1;
            },
        });

        await expect(config.oauthTokenProvider?.()).resolves.toBe('token-123');
        await config.requestRetryHandler?.(403, undefined, 1);
        await config.requestRetryHandler?.(403, undefined, 2);
        await config.requestRetryHandler?.(500, undefined, 1);

        expect(refreshCalls).toBe(1);
    });

    it('loads the current Book number-format settings', async () => {
        const bkper: BrowserBkperClient = {
            getBook: async () => ({
                getId: () => 'book-1',
                getName: () => 'Main Book',
                getDecimalSeparator: () => 'COMMA',
                getFractionDigits: () => 3,
            }),
        };

        const service = createBookService({ auth: createAuth(), bkper });

        await expect(service.getBookFormat('book-1')).resolves.toEqual({
            bookId: 'book-1',
            bookName: 'Main Book',
            decimalSeparator: 'COMMA',
            fractionDigits: 3,
        });
    });

    it('rejects missing or invalid Book number-format settings', async () => {
        const service = createBookService({
            auth: createAuth(),
            bkper: {
                getBook: async () => ({
                    getId: () => 'book-1',
                    getName: () => 'Main Book',
                    getDecimalSeparator: () => undefined,
                    getFractionDigits: () => 2,
                }),
            },
        });

        await expect(service.getBookFormat('book-1')).rejects.toThrow(
            'The Book did not provide its number-format settings.'
        );
    });
});
