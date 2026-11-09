"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function initialsOf(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight">{name}</p>
        <p className="text-xs leading-tight text-muted">{email}</p>
      </div>
      <span
        aria-hidden="true"
        className="grid h-8 w-8 place-items-center rounded-full bg-raised text-sm font-semibold"
      >
        {initialsOf(name)}
      </span>
      <button
        type="button"
        onClick={handleSignOut}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm transition-colors hover:bg-raised"
      >
        <LogOut size={15} aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}
