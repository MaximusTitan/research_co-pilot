import type { SupabaseClient } from "@supabase/supabase-js";
import type { Project } from "../types";

/** A row of public.projects (see supabase/schema.sql). The whole project lives in `data`. */
export interface ProjectRow {
  id: string;
  topic: string;
  data: unknown;
  updated_at: string;
}

const ARRAY_FIELDS = ["angles", "plan", "sources", "notes", "sections", "gaps"] as const;

/** Reads a stored project back, skipping rows that don't look like a project instead of crashing a page. */
export function rowToProject(row: ProjectRow): Project | null {
  const data = row.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const p = data as Partial<Project>;
  if (p.id !== row.id || typeof p.topic !== "string") return null;
  if (!ARRAY_FIELDS.every((f) => Array.isArray(p[f]))) return null;
  return p as Project;
}

/** Columns written on save. `user_id` is filled by the database from the session, never by the browser. */
export function projectToRow(p: Project) {
  return { id: p.id, topic: p.topic.slice(0, 500), data: p };
}

export async function fetchProjects(db: SupabaseClient): Promise<Project[]> {
  const { data, error } = await db.from("projects").select("id, topic, data, updated_at").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as ProjectRow[]).map(rowToProject).filter((p): p is Project => p !== null);
}

export async function saveProjects(db: SupabaseClient, projects: Project[]): Promise<void> {
  if (projects.length === 0) return;
  const { error } = await db.from("projects").upsert(projects.map(projectToRow), { onConflict: "id" });
  if (error) throw error;
}

export async function deleteProject(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from("projects").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchDisplayName(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await db.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  if (error || !data) return null;
  return typeof data.display_name === "string" && data.display_name ? data.display_name : null;
}
