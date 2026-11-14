import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-8 text-xl font-semibold">This page doesn&rsquo;t exist</h1>
        <p className="mt-2 font-serif text-[17px] leading-[1.7] text-muted">
          The link may be old, or the address may have a typo.
        </p>
        <Link
          href="/workspace"
          className="mt-6 inline-flex items-center rounded-lg bg-mark px-4 py-2.5 text-sm font-semibold text-on-mark transition-opacity hover:opacity-90"
        >
          Go to your documents
        </Link>
      </div>
    </main>
  );
}
