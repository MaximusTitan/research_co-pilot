import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "../../components/password-reset";

export const metadata: Metadata = { title: "Reset password · Research Mate" };

export default function ForgotPasswordPage() {
  return (
    // The form reads ?error= from the URL, which is request-time data.
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
