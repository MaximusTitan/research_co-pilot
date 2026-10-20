import type { Metadata } from "next";
import { ResetPasswordForm } from "../../components/password-reset";

export const metadata: Metadata = { title: "New password · Research Mate" };

/** Needs a session (the proxy sends guests to /login); the reset email link provides one. */
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
