"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { Logo } from "@/components/logo";

// Shown when something throws while a page is being drawn. In this version of
// Next.js the recovery function is called `retry`.
export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-8 text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 font-serif text-[17px] leading-[1.7] text-muted">
          This page couldn&rsquo;t be shown. Your documents are safe. Try again, and if it keeps
          happening, reload the page.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-6 inline-flex items-center rounded-lg bg-mark px-4 py-2.5 text-sm font-semibold text-on-mark transition-opacity hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
