import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "../../components/auth-form";

export const metadata: Metadata = { title: "Sign in · Research Co-Pilot" };

export default function LoginPage() {
  return (
    // The form reads ?next= from the URL, which is request-time data.
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
