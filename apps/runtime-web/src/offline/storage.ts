import {
  OFFLINE_OUTBOX_CONTRACT_ID,
  SYNC_BOOTSTRAP_CONTRACT_ID,
  type OfflineOutboxV1,
  type JsonObject,
  type RuntimeProjectionV1,
  type SyncBootstrapV1
} from "@plenum/event-contracts";
import {
  generateOfflineOutboxKey,
  openOfflineData,
  sealOfflineData,
  type SealedOfflineOutboxV1
} from "@plenum/sync-client";

const DATABASE_NAME = "plenum-offline-v1";
const DATABASE_VERSION = 1;

export interface OfflineRuntimeCacheV1 {
  bootstrap: SyncBootstrapV1;
  projection: RuntimeProjectionV1 | null;
  outbox: OfflineOutboxV1;
}

interface StoredKey {
  deviceId: string;
  key: CryptoKey;
}

interface StoredCache {
  id: string;
  sealed: SealedOfflineOutboxV1;
}

function request<T>(input: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    input.onsuccess = () => resolve(input.result);
    input.onerror = () => reject(input.error ?? new Error("Offline storage request failed"));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline storage transaction was aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline storage transaction failed"));
  });
}

function cacheId(sessionId: string, deviceId: string): string {
  return `${sessionId}:${deviceId}`;
}

function isCache(value: unknown, sessionId: string, deviceId: string): value is OfflineRuntimeCacheV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const cache = value as Partial<OfflineRuntimeCacheV1>;
  return cache.bootstrap?.contractId === SYNC_BOOTSTRAP_CONTRACT_ID &&
    cache.outbox?.contractId === OFFLINE_OUTBOX_CONTRACT_ID &&
    cache.bootstrap.sessionId === sessionId && cache.bootstrap.deviceId === deviceId &&
    cache.outbox?.sessionId === sessionId && cache.outbox.deviceId === deviceId &&
    cache.outbox.participantId === cache.bootstrap.participantId &&
    cache.outbox.activeSessionRoleId === cache.bootstrap.activeSessionRoleId &&
    Array.isArray(cache.outbox.entries);
}

export class OfflineRuntimeStore {
  private readonly clearedDraftScopes = new Set<string>();
  private readonly database = new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    open.onupgradeneeded = () => {
      const database = open.result;
      if (!database.objectStoreNames.contains("keys")) database.createObjectStore("keys", { keyPath: "deviceId" });
      if (!database.objectStoreNames.contains("runtime")) database.createObjectStore("runtime", { keyPath: "id" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error("Offline storage is unavailable"));
    open.onblocked = () => reject(new Error("Offline storage upgrade is blocked by another tab"));
  });

  private async key(deviceId: string): Promise<CryptoKey> {
    const database = await this.database;
    const known = await request(database.transaction("keys").objectStore("keys").get(deviceId)) as StoredKey | undefined;
    if (known !== undefined) return known.key;
    const candidate = await generateOfflineOutboxKey();
    const transaction = database.transaction("keys", "readwrite");
    const store = transaction.objectStore("keys");
    const existing = await request(store.get(deviceId)) as StoredKey | undefined;
    const key = existing?.key ?? candidate;
    if (existing === undefined) store.add({ deviceId, key } satisfies StoredKey);
    await transactionComplete(transaction);
    return key;
  }

  async load(sessionId: string, deviceId: string): Promise<OfflineRuntimeCacheV1 | null> {
    const database = await this.database;
    const id = cacheId(sessionId, deviceId);
    const stored = await request(database.transaction("runtime").objectStore("runtime").get(id)) as StoredCache | undefined;
    if (stored === undefined) return null;
    try {
      const value = await openOfflineData(stored.sealed, await this.key(deviceId), id);
      if (!isCache(value, sessionId, deviceId)) throw new Error("scope mismatch");
      return value;
    } catch {
      await this.clear(sessionId, deviceId);
      throw new Error("Protected offline data is corrupt and was cleared");
    }
  }

  async save(cache: OfflineRuntimeCacheV1): Promise<void> {
    const database = await this.database;
    const id = cacheId(cache.bootstrap.sessionId, cache.bootstrap.deviceId);
    const sealed = await sealOfflineData(cache, await this.key(cache.bootstrap.deviceId), id);
    const transaction = database.transaction("runtime", "readwrite");
    transaction.objectStore("runtime").put({ id, sealed } satisfies StoredCache);
    await transactionComplete(transaction);
    this.clearedDraftScopes.delete(id);
  }

  async clear(sessionId: string, deviceId: string): Promise<void> {
    this.clearedDraftScopes.add(cacheId(sessionId, deviceId));
    const database = await this.database;
    const transaction = database.transaction("runtime", "readwrite");
    transaction.objectStore("runtime").delete(cacheId(sessionId, deviceId));
    const cursor = transaction.objectStore("runtime").openCursor();
    cursor.onsuccess = () => {
      const item = cursor.result;
      if (item === null) return;
      if (String(item.key).startsWith(`draft:${cacheId(sessionId, deviceId)}:`)) item.delete();
      item.continue();
    };
    await transactionComplete(transaction);
  }

  async loadDraft(sessionId: string, deviceId: string, scope: string): Promise<JsonObject | null> {
    const database = await this.database;
    const id = `draft:${cacheId(sessionId, deviceId)}:${scope}`;
    const stored = await request(database.transaction("runtime").objectStore("runtime").get(id)) as StoredCache | undefined;
    if (stored === undefined) return null;
    const value = await openOfflineData(stored.sealed, await this.key(deviceId), id);
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("The local draft could not be restored.");
    return value as JsonObject;
  }

  async saveDraft(sessionId: string, deviceId: string, scope: string, content: JsonObject | null): Promise<void> {
    const database = await this.database;
    const id = `draft:${cacheId(sessionId, deviceId)}:${scope}`;
    if (content !== null && JSON.stringify(content).length > 262_144) throw new Error("This draft is too large to save on this device.");
    const sealed = content === null ? null : await sealOfflineData(content, await this.key(deviceId), id);
    if (this.clearedDraftScopes.has(cacheId(sessionId, deviceId))) throw new Error("Session access was cleared. The draft was not saved.");
    const transaction = database.transaction("runtime", "readwrite");
    if (sealed === null) transaction.objectStore("runtime").delete(id);
    else transaction.objectStore("runtime").put({ id, sealed } satisfies StoredCache);
    await transactionComplete(transaction);
  }
}
