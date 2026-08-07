export interface HistoryEntry {
    expression: string;
    result: string;
}

export interface HistoryStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

const DEFAULT_HISTORY_LIMIT = 20;
const HISTORY_KEY_PREFIX = 'bkper-in-app-calculator:';

export function createHistoryStore(
    bookId: string,
    storage: HistoryStorage = window.sessionStorage,
    limit = DEFAULT_HISTORY_LIMIT
) {
    const key = `${HISTORY_KEY_PREFIX}${bookId}`;

    return {
        get(): HistoryEntry[] {
            const raw = storage.getItem(key);
            if (!raw) {
                return [];
            }

            try {
                const parsed: unknown = JSON.parse(raw);
                if (!Array.isArray(parsed)) {
                    return [];
                }
                return parsed.filter(isHistoryEntry).slice(0, limit);
            } catch {
                return [];
            }
        },

        add(entry: HistoryEntry): void {
            const entries = [entry, ...this.get()].slice(0, limit);
            storage.setItem(key, JSON.stringify(entries));
        },

        clear(): void {
            storage.removeItem(key);
        },
    };
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const entry = value as { expression?: unknown; result?: unknown };
    return typeof entry.expression === 'string' && typeof entry.result === 'string';
}
