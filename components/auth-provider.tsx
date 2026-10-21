"use client";

import { createContext, use, useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { fetchDisplayName } from "../lib/db/projects";
import { SHOWCASE_TOPIC, showcaseProject } from "../lib/showcase";
import { projectStore } from "../lib/store";
import { supabaseBrowser } from "../lib/supabase/client";

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

/** undefined = still checking, null = signed out. */
const AuthContext = createContext<AuthUser | null | undefined>(undefined);

export function useAuthUser(): AuthUser | null | undefined {
  return use(AuthContext);
}

/**
 * Follows the Supabase session in the browser and loads that user's projects.
 * Page access itself is enforced by the proxy and by row-level security.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null;
      if (!next) {
        setUser(null);
        void projectStore.reset();
        return;
      }
      setUser((prev) => (prev?.id === next.id ? prev : { id: next.id, email: next.email ?? null, displayName: null }));
      // Supabase warns against awaiting its own calls inside this callback, so defer them.
      window.setTimeout(() => {
        if (!active) return;
        void projectStore.load(next.id).then(() => {
          if (active) addShowcaseOnce(supabase, next);
        });
        void fetchDisplayName(supabase, next.id).then((displayName) => {
          if (active && displayName) setUser((prev) => (prev?.id === next.id ? { ...prev, displayName } : prev));
        });
      }, 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext value={user}>{children}</AuthContext>;
}

const SHOWCASE_FLAG = "showcase_added";

/**
 * Gives every account its own copy of the showcase project, once. The flag is
 * kept on the account so a student who deletes it doesn't get it back.
 */
function addShowcaseOnce(supabase: SupabaseClient, user: User) {
  if (user.user_metadata?.[SHOWCASE_FLAG]) return;
  const state = projectStore.snapshot();
  if (!state) return;
  const alreadyThere = Object.values(state.projects).some((p) => p.topic === SHOWCASE_TOPIC);
  if (!alreadyThere && !projectStore.insert(showcaseProject())) return;
  void supabase.auth.updateUser({ data: { [SHOWCASE_FLAG]: true } });
}
