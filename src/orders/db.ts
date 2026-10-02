import { isBrowserOrder, type BrowserOrder } from "./model";

const DATABASE_NAME = "fliq-market";
const DATABASE_VERSION = 1;
const ORDER_STORE = "orders";

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.addEventListener("success", () => resolve(request.result));
        request.addEventListener("error", () =>
            reject(request.error ?? new Error("Browser database request failed.")),
        );
    });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.addEventListener("complete", () => resolve());
        transaction.addEventListener("abort", () =>
            reject(
                transaction.error ??
                    new Error("Browser database transaction was aborted."),
            ),
        );
        transaction.addEventListener("error", () =>
            reject(
                transaction.error ??
                    new Error("Browser database transaction failed."),
            ),
        );
    });
}

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.addEventListener("upgradeneeded", () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(ORDER_STORE)) {
                const store = database.createObjectStore(ORDER_STORE, {
                    keyPath: "id",
                });
                store.createIndex("createdAt", "createdAt");
            }
        });
        request.addEventListener("success", () => resolve(request.result));
        request.addEventListener("error", () =>
            reject(
                request.error ?? new Error("Unable to open the browser database."),
            ),
        );
        request.addEventListener("blocked", () =>
            reject(
                new Error(
                    "The browser database is blocked by another open FliQ Market tab.",
                ),
            ),
        );
    });
}

export async function listOrders(): Promise<BrowserOrder[]> {
    const database = await openDatabase();
    try {
        const transaction = database.transaction(ORDER_STORE, "readonly");
        const rows = await requestResult(
            transaction.objectStore(ORDER_STORE).getAll(),
        );
        return rows
            .filter(isBrowserOrder)
            .sort(
                (left, right) =>
                    new Date(right.createdAt).getTime() -
                    new Date(left.createdAt).getTime(),
            );
    } finally {
        database.close();
    }
}

export async function getOrder(id: string): Promise<BrowserOrder | null> {
    const database = await openDatabase();
    try {
        const transaction = database.transaction(ORDER_STORE, "readonly");
        const row: unknown = await requestResult(
            transaction.objectStore(ORDER_STORE).get(id),
        );
        return isBrowserOrder(row) ? row : null;
    } finally {
        database.close();
    }
}

export async function putOrder(order: BrowserOrder): Promise<void> {
    const database = await openDatabase();
    try {
        const transaction = database.transaction(ORDER_STORE, "readwrite");
        const complete = transactionComplete(transaction);
        transaction.objectStore(ORDER_STORE).put(order);
        await complete;
    } finally {
        database.close();
    }
}
