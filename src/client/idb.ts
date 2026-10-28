const DB = "exun-underground";
const STORE = "keys";

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.addEventListener("upgradeneeded", () => request.result.createObjectStore(STORE));
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error));
    });
  } finally {
    db.close();
  }
}

export const readSlot = <T>(slot: string) =>
  run<T | undefined>("readonly", (store) => store.get(slot));
export const writeSlot = (slot: string, value: unknown) =>
  run("readwrite", (store) => store.put(value, slot));
export const clearSlot = (slot: string) => run("readwrite", (store) => store.delete(slot));
