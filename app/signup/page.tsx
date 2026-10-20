import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "../../components/auth-form";

export const metadata: Metadata = { title: "Sign up · Research Mate" };

export default function SignupPage() {
  return (
    // The form reads ?next= from the URL, which is request-time data.
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
