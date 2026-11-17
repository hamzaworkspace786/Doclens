import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DOCUMENT_RETENTION_DAYS } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { AuthForm } from "@/components/auth-form";
import { LoginExcerpt } from "@/components/login-excerpt";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Sign in" };

// Signed-in visitors skip the login page. This reads the session, so it has
// to sit inside <Suspense> (Cache Components rule) and runs on every request.
async function RedirectIfSignedIn() {
  const session = await getSession();
  if (session) redirect("/workspace");
  return null;
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>

      <section className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-12">
          <AuthForm />
        </div>
        <p className="text-center text-xs leading-relaxed text-muted">
          Free portfolio project. Uploaded documents are processed by Google&rsquo;s AI and deleted
          after {DOCUMENT_RETENTION_DAYS} days.{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-text">
            Privacy
          </Link>
        </p>
      </section>

      <aside
        aria-hidden="true"
        className="hidden items-center justify-center border-l border-line bg-panel px-12 lg:flex"
      >
        <LoginExcerpt />
      </aside>
    </main>
  );
}
