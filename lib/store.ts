"use client";

import { useSyncExternalStore } from "react";
import { deleteProject, fetchProjects, saveProjects } from "./db/projects";
import { supabaseBrowser } from "./supabase/client";
import type { Project } from "./types";

/** Projects saved in this browser before accounts existed; moved into the first account that signs in here. */
const LEGACY_KEY = "research-copilot:v1";
const SAVE_DELAY_MS = 800;

export interface StoreState {
  currentId: string | null;
  projects: Record<string, Project>;
}

export type SaveStatus = "idle" | "saving" | "error";

const listeners = new Set<() => void>();
let cache: StoreState | null = null;
let userId: string | null = null;
let saveStatus: SaveStatus = "idle";
const dirty = new Set<string>();
let saveTimer: number | undefined;
let saving: Promise<void> | null = null;
let loadFailed = false;

const currentKey = (uid: string) => `research-copilot:current:${uid}`;

function notify() {
  listeners.forEach((l) => l());
}

function setStatus(next: SaveStatus) {
  if (saveStatus === next) return;
  saveStatus = next;
  notify();
}

function rememberCurrent(id: string | null) {
  if (!userId) return;
  try {
    if (id) window.localStorage.setItem(currentKey(userId), id);
    else window.localStorage.removeItem(currentKey(userId));
  } catch {
    // Storage blocked: the open project is just forgotten on reload.
  }
}

function write(next: StoreState, changed: string[] = []) {
  cache = next;
  changed.forEach((id) => dirty.add(id));
  // Unsaved changes count as saving, so nothing claims "Saved" before the database has them.
  if (changed.length && userId) saveStatus = "saving";
  notify();
  if (changed.length) scheduleSave();
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
}

/** Sends every changed project to Supabase. Failed ones stay dirty and are retried on the next change. */
async function flush(): Promise<void> {
  window.clearTimeout(saveTimer);
  if (saving) await saving;
  if (!cache || !userId || dirty.size === 0) return;
  const ids = [...dirty];
  dirty.clear();
  const batch = ids.map((id) => cache?.projects[id]).filter((p): p is Project => Boolean(p));
  setStatus("saving");
  saving = saveProjects(supabaseBrowser(), batch)
    .then(() => setStatus(dirty.size ? "saving" : "idle"))
    .catch(() => {
      ids.forEach((id) => dirty.add(id));
      setStatus("error");
    })
    .finally(() => {
      saving = null;
    });
  await saving;
}

function readLegacy(): Project[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { projects?: Record<string, Project> };
    return parsed?.projects && typeof parsed.projects === "object" ? Object.values(parsed.projects) : [];
  } catch {
    return [];
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Returns null while server rendering or until the signed-in user's projects have loaded. */
export function useStore(): StoreState | null {
  return useSyncExternalStore(subscribe, () => cache, () => null);
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(subscribe, () => saveStatus, () => "idle");
}

export function useCurrentProject(): { ready: boolean; project: Project | null } {
  const state = useStore();
  if (!state) return { ready: false, project: null };
  return { ready: true, project: state.currentId ? (state.projects[state.currentId] ?? null) : null };
}

export const projectStore = {
  /** The current state outside React, or null until the user's projects have loaded. */
  snapshot(): StoreState | null {
    return cache;
  },
  /** Loads the signed-in user's projects. Called by the auth provider whenever the user changes. */
  async load(uid: string) {
    if (userId === uid && cache) return;
    userId = uid;
    cache = null;
    dirty.clear();
    notify();

    const db = supabaseBrowser();
    const legacy = readLegacy();
    if (legacy.length) {
      try {
        await saveProjects(db, legacy);
        window.localStorage.removeItem(LEGACY_KEY);
      } catch {
        // Leave the old copy in place and try again next sign-in.
      }
    }

    let list: Project[] = [];
    loadFailed = false;
    try {
      list = await fetchProjects(db);
    } catch {
      loadFailed = true;
    }
    if (userId !== uid) return; // Signed out or switched account while loading.
    if (loadFailed) setStatus("error");

    const projects = Object.fromEntries(list.map((p) => [p.id, p]));
    let currentId: string | null = null;
    try {
      currentId = window.localStorage.getItem(currentKey(uid));
    } catch {
      currentId = null;
    }
    cache = { currentId: currentId && projects[currentId] ? currentId : null, projects };
    notify();
  },
  /** Saves anything pending, then forgets the previous user's projects in this tab. */
  async reset() {
    await flush().catch(() => {});
    userId = null;
    cache = null;
    dirty.clear();
    saveStatus = "idle";
    notify();
  },
  add(project: Project) {
    const s = cache ?? { currentId: null, projects: {} };
    write({ currentId: project.id, projects: { ...s.projects, [project.id]: project } }, [project.id]);
    rememberCurrent(project.id);
  },
  /**
   * Adds a project to the list without opening it, below the student's own work.
   * Returns false if the list hasn't loaded, so nothing is added on top of a failed load.
   */
  insert(project: Project): boolean {
    if (!cache || loadFailed) return false;
    const oldest = Math.min(...Object.values(cache.projects).map((p) => p.updatedAt));
    const placed = Number.isFinite(oldest) ? { ...project, createdAt: oldest - 1000, updatedAt: oldest - 1000 } : project;
    write({ ...cache, projects: { ...cache.projects, [placed.id]: placed } }, [placed.id]);
    return true;
  },
  select(id: string) {
    if (!cache?.projects[id]) return;
    write({ ...cache, currentId: id });
    rememberCurrent(id);
  },
  remove(id: string) {
    if (!cache) return;
    const projects = { ...cache.projects };
    delete projects[id];
    dirty.delete(id);
    const currentId = cache.currentId === id ? null : cache.currentId;
    write({ currentId, projects });
    if (currentId === null) rememberCurrent(null);
    // Wait for an in-flight save so it can't re-create the row after the delete.
    Promise.resolve(saving)
      .then(() => deleteProject(supabaseBrowser(), id))
      .catch(() => setStatus("error"));
  },
  /** Applies a pure update to the current project. `touch: false` keeps its "last updated" time, for bookkeeping like the current step. */
  update(fn: (p: Project) => Project, { touch = true }: { touch?: boolean } = {}) {
    const current = cache?.currentId ? cache.projects[cache.currentId] : null;
    if (!cache || !current) return;
    const next = fn(current);
    if (next === current) return;
    const updatedAt = touch ? Date.now() : current.updatedAt;
    write({ ...cache, projects: { ...cache.projects, [current.id]: { ...next, updatedAt } } }, [current.id]);
  },
  /** Retries after an error: reloads if loading failed, otherwise re-sends unsaved changes. */
  retry() {
    if (loadFailed && userId) {
      const uid = userId;
      // Save anything made since, then fetch the full list again.
      void flush().then(() => {
        if (userId !== uid || dirty.size) return;
        userId = null;
        setStatus("idle");
        return projectStore.load(uid);
      });
    } else if (dirty.size) {
      void flush();
    } else {
      setStatus("idle");
    }
  },
};
