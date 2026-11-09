"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type Mode = "signin" | "signup";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

const inputClass =
  "w-full rounded-lg border border-line bg-panel px-3.5 py-2.5 text-[15px] text-text placeholder:text-muted/70 focus:border-mark focus:outline-none disabled:opacity-60";

export function AuthForm() {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const isSignUp = mode === "signup";
  // "pending" covers the request; "navigating" covers the move to the workspace.
  // Both reset on their own, so the form is never left stuck when this page
  // is kept alive in the background (Cache Components does that).
  const busy = pending || navigating;

  // If the browser restores this page from its back/forward cache (for example
  // after pressing Back from the workspace), make sure the form is usable again.
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) setPending(false);
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);

    const result = isSignUp
      ? await authClient.signUp.email({ name, email, password })
      : await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? "Something went wrong. Try again.");
      setPending(false);
      return;
    }

    setPending(false);
    setPassword("");
    startNavigation(() => {
      router.replace("/workspace");
      router.refresh();
    });
  }

  async function handleGoogle() {
    setError("");
    setPending(true);
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/workspace",
    });
    // On success the browser redirects to Google, so we only land here on failure.
    if (result?.error) {
      setError(
        result.error.message ??
          "Google sign-in is not available. Use your email and password instead.",
      );
      setPending(false);
    }
  }

  function switchMode() {
    setMode(isSignUp ? "signin" : "signup");
    setError("");
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isSignUp ? "Create your account" : "Sign in to DocLens"}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Upload a document, get a summary, and ask it questions. Every answer
        points to the page it came from.
      </p>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy}
        className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-panel px-4 py-2.5 text-[15px] font-medium transition-colors hover:bg-raised disabled:opacity-60"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3 text-sm text-muted">
        <span className="h-px flex-1 bg-line" />
        or use your email
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted transition-colors hover:text-text"
            >
              {showPassword ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          </div>
          {isSignUp && (
            <p className="mt-1.5 text-sm text-muted">Use at least 8 characters.</p>
          )}
        </div>

        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-danger">
          {error}
        </p>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-mark px-4 py-2.5 text-[15px] font-semibold text-on-mark transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy
            ? isSignUp
              ? "Creating account..."
              : "Signing in..."
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {isSignUp ? "Already have an account?" : "New to DocLens?"}{" "}
        <button
          type="button"
          onClick={switchMode}
          className="font-medium text-text underline underline-offset-4 hover:text-mark"
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </button>
      </p>
    </div>
  );
}
