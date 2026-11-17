import { describe, expect, it } from 'bun:test';
import { createHistoryStore, type HistoryStorage } from '../src/calculator/history';

function createStorage(): HistoryStorage {
    const values = new Map<string, string>();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key),
    };
}

describe('calculator history', () => {
    it('keeps newest entries first and limits the session history', () => {
        const store = createHistoryStore('book-1', createStorage(), 2);

        store.add({ expression: '1 + 1', result: '2.00' });
        store.add({ expression: '2 + 2', result: '4.00' });
        store.add({ expression: '3 + 3', result: '6.00' });

        expect(store.get()).toEqual([
            { expression: '3 + 3', result: '6.00' },
            { expression: '2 + 2', result: '4.00' },
        ]);
    });

    it('keeps histories separate by book and survives store recreation', () => {
        const storage = createStorage();
        const bookOne = createHistoryStore('book-1', storage);
        bookOne.add({ expression: '1 + 1', result: '2.00' });

        expect(createHistoryStore('book-2', storage).get()).toEqual([]);
        expect(createHistoryStore('book-1', storage).get()).toEqual([
            { expression: '1 + 1', result: '2.00' },
        ]);
    });

    it('keeps working in memory when browser storage is unavailable', () => {
        const blocked: HistoryStorage = {
            getItem: () => {
                throw new Error('SecurityError');
            },
            setItem: () => {
                throw new Error('QuotaExceededError');
            },
            removeItem: () => {
                throw new Error('SecurityError');
            },
        };
        const store = createHistoryStore('book-1', blocked);

        expect(store.get()).toEqual([]);
        expect(() => store.add({ expression: '1 + 1', result: '2.00' })).not.toThrow();
        expect(store.get()).toEqual([{ expression: '1 + 1', result: '2.00' }]);
        expect(() => store.clear()).not.toThrow();
        expect(store.get()).toEqual([]);
    });

    it('falls back to memory when session storage cannot be accessed', () => {
        const store = createHistoryStore('book-1', () => {
            throw new Error('SecurityError');
        });

        store.add({ expression: '1 + 1', result: '2.00' });

        expect(store.get()).toEqual([{ expression: '1 + 1', result: '2.00' }]);
    });

    it('clears only the selected book history', () => {
        const storage = createStorage();
        const bookOne = createHistoryStore('book-1', storage);
        const bookTwo = createHistoryStore('book-2', storage);
        bookOne.add({ expression: '1 + 1', result: '2.00' });
        bookTwo.add({ expression: '2 + 2', result: '4.00' });

        bookOne.clear();

        expect(bookOne.get()).toEqual([]);
        expect(bookTwo.get()).toEqual([{ expression: '2 + 2', result: '4.00' }]);
    });
});
