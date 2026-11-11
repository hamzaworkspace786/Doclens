"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LogOut, X } from "lucide-react";
import Image from "next/image";
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

function AccountImage({ fallback }: { fallback: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) return <span aria-hidden="true">{fallback}</span>;

  return (
    <Image
      src="/api/profile-image"
      alt=""
      width={64}
      height={64}
      unoptimized
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function ProfileAvatar({
  name,
  image,
  size,
}: {
  name: string;
  image: string | null;
  size: "small" | "large";
}) {
  const sizeClass = size === "large" ? "h-16 w-16 text-xl" : "h-8 w-8 text-sm";

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-raised font-semibold ${sizeClass}`}
    >
      {image ? (
        <AccountImage
          key={image}
          fallback={initialsOf(name)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

export function UserMenu({
  name,
  email,
  image,
}: {
  name: string;
  email: string;
  image: string | null;
}) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [savedName, setSavedName] = useState<{
    from: string;
    value: string;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const displayName =
    session?.user.name ??
    (savedName?.from === name ? savedName.value : name);
  const profileImage = image ?? session?.user.image ?? null;

  useEffect(() => {
    if (!editing) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setEditing(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editing]);

  function openEditor() {
    setNewName(displayName);
    setError("");
    setEditing(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const updatedName = newName.trim();
    if (!updatedName) {
      setError("Enter a name to continue.");
      return;
    }
    if (updatedName.length > 80) {
      setError("Your name must be 80 characters or fewer.");
      return;
    }
    if (updatedName === displayName) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result = await authClient.updateUser({ name: updatedName });
      if (result.error) {
        setError(result.error.message ?? "Your name could not be updated.");
        return;
      }

      setSavedName({ from: name, value: updatedName });
      setEditing(false);
      router.refresh();
    } catch {
      setError("Your name could not be updated. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={openEditor}
          aria-label={`Edit profile for ${displayName}`}
          className="flex min-w-0 items-center gap-2 text-left sm:gap-3"
        >
          <div className="min-w-0 max-w-[min(34vw,180px)] sm:max-w-none">
            <p className="truncate text-sm font-medium leading-tight">
              {displayName}
            </p>
            <p className="truncate text-xs leading-tight text-muted">{email}</p>
          </div>
          <ProfileAvatar
            name={displayName}
            image={profileImage}
            size="small"
          />
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm transition-colors hover:bg-raised sm:px-3"
        >
          <LogOut size={15} aria-hidden="true" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>

      {editing && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setEditing(false);
            }
          }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
            className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2
                  id="profile-modal-title"
                  className="text-lg font-semibold"
                >
                  Edit profile
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Update the name shown in your workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                aria-label="Close profile editor"
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-raised hover:text-text disabled:opacity-60"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="my-5 flex items-center gap-3">
              <ProfileAvatar
                name={displayName}
                image={profileImage}
                size="large"
              />
              <div className="min-w-0">
                <p className="truncate font-medium">{displayName}</p>
                <p className="truncate text-sm text-muted">{email}</p>
              </div>
            </div>

            <form onSubmit={handleSave}>
              <label
                htmlFor="profile-name"
                className="mb-1.5 block text-sm font-medium"
              >
                Name
              </label>
              <input
                id="profile-name"
                type="text"
                autoComplete="name"
                autoFocus
                required
                maxLength={80}
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                disabled={saving}
                className="w-full rounded-lg border border-line bg-ink px-3.5 py-2.5 text-[15px] text-text placeholder:text-muted/70 focus:border-mark focus:outline-none disabled:opacity-60"
              />
              <p className="mt-2 min-h-5 text-sm text-danger" role="alert">
                {error}
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="rounded-lg border border-line px-3.5 py-2 text-sm transition-colors hover:bg-raised disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-mark px-3.5 py-2 text-sm font-semibold text-on-mark transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
