import { z } from "zod";

export const PASSWORD_MIN = 8;

const email = z.string().trim().toLowerCase().pipe(z.email({ error: "invalidEmail" })).pipe(z.string().max(254, { error: "invalidEmail" }));

export const loginInput = z.object({
  email,
  password: z.string().min(1, { error: "passwordRequired" }).max(128, { error: "passwordTooLong" }),
});

export const signupInput = z.object({
  displayName: z.string().trim().min(1, { error: "nameRequired" }).max(80, { error: "nameTooLong" }),
  email,
  password: z
    .string()
    .min(PASSWORD_MIN, { error: "passwordTooShort" })
    .max(128, { error: "passwordTooLong" })
    .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), { error: "passwordWeak" }),
});

export type AuthErrorKey =
  | "invalidEmail"
  | "passwordRequired"
  | "passwordTooShort"
  | "passwordTooLong"
  | "passwordWeak"
  | "nameRequired"
  | "nameTooLong"
  | "invalidCredentials"
  | "rateLimited"
  | "generic";

const KEYS = new Set<string>([
  "invalidEmail",
  "passwordRequired",
  "passwordTooShort",
  "passwordTooLong",
  "passwordWeak",
  "nameRequired",
  "nameTooLong",
]);

/** First validation problem as a dictionary key, so the form can show it in the student's language. */
export function firstIssue(error: z.ZodError): AuthErrorKey {
  const message = error.issues[0]?.message;
  return message && KEYS.has(message) ? (message as AuthErrorKey) : "generic";
}

/**
 * Turns a Supabase auth error code into a message key. Unknown errors stay
 * generic so the page never reveals whether an email has an account.
 */
export function authErrorKey(code: string | undefined): AuthErrorKey {
  switch (code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "weak_password":
      return "passwordWeak";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rateLimited";
    default:
      return "generic";
  }
}
