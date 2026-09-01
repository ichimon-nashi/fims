// src/lib/offlineStore.ts
// Deliberately dependency-free (raw indexedDB) rather than pulling in
// `idb` for what's really just one object store with get/put/delete/list.

const DB_NAME = "fims_offline";
const STORE = "pending_self_inspections";
const DRAFT_STORE = "self_inspection_draft";
const DRAFT_KEY = "current"; // single resumable draft — matches "at most 15/month" volume, one in-progress form at a time is enough

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 2);
		req.onupgradeneeded = (event) => {
			if (!req.result.objectStoreNames.contains(STORE)) {
				req.result.createObjectStore(STORE, { keyPath: "client_uuid" });
			}
			if (!req.result.objectStoreNames.contains(DRAFT_STORE)) {
				req.result.createObjectStore(DRAFT_STORE, { keyPath: "key" });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function saveDraft(draft: Record<string, unknown>): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(DRAFT_STORE, "readwrite");
		tx.objectStore(DRAFT_STORE).put({ key: DRAFT_KEY, ...draft });
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function loadDraft(): Promise<Record<string, unknown> | null> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(DRAFT_STORE, "readonly");
		const req = tx.objectStore(DRAFT_STORE).get(DRAFT_KEY);
		req.onsuccess = () => resolve(req.result ?? null);
		req.onerror = () => reject(req.error);
	});
}

export async function clearDraft(): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(DRAFT_STORE, "readwrite");
		tx.objectStore(DRAFT_STORE).delete(DRAFT_KEY);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function queueSubmission(payload: Record<string, unknown>): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).put(payload);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function listQueuedSubmissions(): Promise<Record<string, unknown>[]> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, "readonly");
		const req = tx.objectStore(STORE).getAll();
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function removeQueuedSubmission(clientUuid: string): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).delete(clientUuid);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}