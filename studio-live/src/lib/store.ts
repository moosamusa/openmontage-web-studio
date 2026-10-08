// IndexedDB persistence for projects and uploaded blobs, with a small
// subscribe/notify layer for React (useSyncExternalStore).
import { useSyncExternalStore } from "react";
import type { Project } from "./types";

const DB = "openmontage-web-studio";
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(store, mode).objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

let cache: Project[] | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export async function loadAll(): Promise<Project[]> {
  const all = await tx<Project[]>("projects", "readonly", (s) => s.getAll() as IDBRequest<Project[]>);
  cache = all.sort((a, b) => b.updatedAt - a.updatedAt);
  notify();
  return cache;
}

export async function saveProject(p: Project): Promise<void> {
  await tx("projects", "readwrite", (s) => s.put(p));
  cache = [p, ...(cache ?? []).filter((x) => x.id !== p.id)].sort((a, b) => b.updatedAt - a.updatedAt);
  notify();
}

export async function deleteProject(id: string): Promise<void> {
  const p = cache?.find((x) => x.id === id);
  for (const a of p?.assets ?? []) if (a.blobKey) await deleteBlob(a.blobKey);
  await tx("projects", "readwrite", (s) => s.delete(id));
  cache = (cache ?? []).filter((x) => x.id !== id);
  notify();
}

export const putBlob = (key: string, blob: Blob) => tx("blobs", "readwrite", (s) => s.put(blob, key));
export const getBlob = (key: string) => tx<Blob | undefined>("blobs", "readonly", (s) => s.get(key));
export const deleteBlob = (key: string) => tx("blobs", "readwrite", (s) => s.delete(key));

function subscribe(l: () => void) {
  listeners.add(l);
  if (cache === null && typeof indexedDB !== "undefined") void loadAll();
  return () => listeners.delete(l);
}

export function useProjects(): Project[] | null {
  return useSyncExternalStore(subscribe, () => cache, () => null);
}

export function useProject(id: string): Project | null | undefined {
  const all = useProjects();
  if (all === null) return undefined; // loading
  return all.find((p) => p.id === id) ?? null;
}
