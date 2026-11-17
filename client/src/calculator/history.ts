export interface HistoryEntry {
    expression: string;
    result: string;
}

export interface HistoryStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export interface HistoryStore {
    get(): HistoryEntry[];
    add(entry: HistoryEntry): void;
    clear(): void;
}

const DEFAULT_HISTORY_LIMIT = 20;
const HISTORY_KEY_PREFIX = 'bkper-in-app-calculator:';

// History is a convenience, never a requirement: browsers can block or fill storage inside an
// embedded iframe, so every storage failure degrades to an in-memory list instead of an error.
export function createHistoryStore(
    bookId: string,
    storage: HistoryStorage | (() => HistoryStorage) = getSessionStorage,
    limit = DEFAULT_HISTORY_LIMIT
): HistoryStore {
    const key = `${HISTORY_KEY_PREFIX}${bookId}`;
    const persistent = resolveStorage(storage);
    let entries: HistoryEntry[] | null = null;

    const load = (): HistoryEntry[] => {
        if (entries) {
            return entries;
        }

        entries = readEntries(persistent, key, limit);
        return entries;
    };

    return {
        get(): HistoryEntry[] {
            return [...load()];
        },

        add(entry: HistoryEntry): void {
            entries = [entry, ...load()].slice(0, limit);
            attempt(() => persistent?.setItem(key, JSON.stringify(entries)));
        },

        clear(): void {
            entries = [];
            attempt(() => persistent?.removeItem(key));
        },
    };
}

function getSessionStorage(): HistoryStorage {
    return window.sessionStorage;
}

function resolveStorage(
    storage: HistoryStorage | (() => HistoryStorage)
): HistoryStorage | undefined {
    if (typeof storage !== 'function') {
        return storage;
    }

    try {
        return storage();
    } catch {
        return undefined;
    }
}

function readEntries(
    storage: HistoryStorage | undefined,
    key: string,
    limit: number
): HistoryEntry[] {
    const raw = attempt(() => storage?.getItem(key) ?? null);
    if (!raw) {
        return [];
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isHistoryEntry).slice(0, limit) : [];
    } catch {
        return [];
    }
}

function attempt<T>(operation: () => T): T | null {
    try {
        return operation();
    } catch {
        return null;
    }
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const entry = value as { expression?: unknown; result?: unknown };
    return typeof entry.expression === 'string' && typeof entry.result === 'string';
}
