import { describe, expect, it } from "vitest";
import { confirmUrl, isGuestOnlyPath, isPublicPath, RESET_PASSWORD, safeNextPath } from "../lib/auth/routes";
import { authErrorKey, firstIssue, forgotPasswordInput, loginInput, resetPasswordInput, signupInput } from "../lib/auth/validation";
import { projectToRow, rowToProject } from "../lib/db/projects";
import { dictionaries } from "../lib/i18n";
import { createProject } from "../lib/project";

describe("post-login redirects", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/notes")).toBe("/notes");
    expect(safeNextPath("/write?section=1")).toBe("/write?section=1");
  });

  it("refuses anything that could leave the site", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "evil.com", "/\u0000x", "", null, undefined]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });

  it("doesn't loop back to the sign-in pages", () => {
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/signup?next=/x")).toBe("/");
  });
});

describe("route access", () => {
  it("lets guests reach only the sign-in pages and the email link", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/signup")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/reset-password")).toBe(false);
    expect(isPublicPath("/auth/other")).toBe(false);
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/start")).toBe(false);
    expect(isPublicPath("/projects")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });

  it("sends signed-in users away from login and signup only", () => {
    expect(isGuestOnlyPath("/login")).toBe(true);
    expect(isGuestOnlyPath("/")).toBe(true);
    expect(isGuestOnlyPath("/projects")).toBe(false);
    expect(isGuestOnlyPath("/auth/confirm")).toBe(false);
    expect(isGuestOnlyPath("/forgot-password")).toBe(true);
    expect(isGuestOnlyPath("/reset-password")).toBe(false);
  });
});

describe("verification email link", () => {
  it("sends a reset link on to the new-password page", () => {
    const url = new URL(confirmUrl("https://app.example", RESET_PASSWORD));
    expect(url.pathname).toBe("/auth/confirm");
    expect(url.searchParams.get("next")).toBe("/reset-password");
  });

  it("points at /auth/confirm on this site and carries a safe next", () => {
    expect(confirmUrl("http://localhost:3000", "/notes")).toBe("http://localhost:3000/auth/confirm?next=%2Fnotes");
    expect(confirmUrl("https://app.example.org", "//evil.com")).toBe("https://app.example.org/auth/confirm?next=%2F");
  });
});

describe("auth form validation", () => {
  it("normalises the email on login", () => {
    const out = loginInput.safeParse({ email: "  Student@School.ORG ", password: "x" });
    expect(out.success && out.data.email).toBe("student@school.org");
  });

  it("reports the first problem as a dictionary key", () => {
    const bad = signupInput.safeParse({ displayName: "", email: "nope", password: "short" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(firstIssue(bad.error)).toBe("nameRequired");
  });

  it("asks for a longer, mixed password on sign-up", () => {
    const base = { displayName: "Asha", email: "asha@example.com" };
    const short = signupInput.safeParse({ ...base, password: "abc123" });
    const letters = signupInput.safeParse({ ...base, password: "abcdefghij" });
    expect(!short.success && firstIssue(short.error)).toBe("passwordTooShort");
    expect(!letters.success && firstIssue(letters.error)).toBe("passwordWeak");
    expect(signupInput.safeParse({ ...base, password: "bees4ever!" }).success).toBe(true);
  });

  it("checks a new password with the sign-up rules and asks for it twice", () => {
    const weak = resetPasswordInput.safeParse({ password: "abcdefghij", confirm: "abcdefghij" });
    const mismatch = resetPasswordInput.safeParse({ password: "bees4ever!", confirm: "bees4ever?" });
    expect(!weak.success && firstIssue(weak.error)).toBe("passwordWeak");
    expect(!mismatch.success && firstIssue(mismatch.error)).toBe("passwordMismatch");
    expect(resetPasswordInput.safeParse({ password: "bees4ever!", confirm: "bees4ever!" }).success).toBe(true);
  });

  it("normalises the email when asking for a reset link", () => {
    const out = forgotPasswordInput.safeParse({ email: " Asha@Example.com " });
    expect(out.success && out.data.email).toBe("asha@example.com");
    const bad = forgotPasswordInput.safeParse({ email: "nope" });
    expect(!bad.success && firstIssue(bad.error)).toBe("invalidEmail");
  });

  it("keeps unknown Supabase errors generic so accounts can't be probed", () => {
    expect(authErrorKey("invalid_credentials")).toBe("invalidCredentials");
    expect(authErrorKey("over_email_send_rate_limit")).toBe("rateLimited");
    expect(authErrorKey("email_not_confirmed")).toBe("emailNotConfirmed");
    expect(authErrorKey("same_password")).toBe("samePassword");
    expect(authErrorKey("user_already_exists")).toBe("generic");
    expect(authErrorKey(undefined)).toBe("generic");
  });

  it("has every auth message in both languages", () => {
    const keys = Object.keys(dictionaries.en.auth.errors).sort();
    expect(Object.keys(dictionaries.hi.auth.errors).sort()).toEqual(keys);
  });
});

describe("project rows", () => {
  const project = createProject({ topic: "Why are bees disappearing?", writingType: "report", grade: "7-8", introTitle: "Intro", conclusionTitle: "End" });

  it("round-trips a project through a row", () => {
    const row = { ...projectToRow(project), updated_at: new Date().toISOString() };
    expect(row).not.toHaveProperty("user_id");
    expect(rowToProject(row)).toEqual(project);
  });

  it("skips rows that don't hold a project", () => {
    const at = new Date().toISOString();
    expect(rowToProject({ id: project.id, topic: "x", data: null, updated_at: at })).toBeNull();
    expect(rowToProject({ id: "other", topic: "x", data: project, updated_at: at })).toBeNull();
    expect(rowToProject({ id: project.id, topic: "x", data: { ...project, notes: "oops" }, updated_at: at })).toBeNull();
  });
});
