"use client";

import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { fetchDisplayName } from "../lib/db/projects";
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
        void projectStore.load(next.id);
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
