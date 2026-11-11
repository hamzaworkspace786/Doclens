import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export async function getSession({ fresh = false }: { fresh?: boolean } = {}) {
  return auth.api.getSession({
    headers: await headers(),
    query: fresh ? { disableCookieCache: true } : undefined,
  });
}

/** For API route handlers: returns null instead of redirecting, so you can answer 401. */
export async function getUserOrNull({ fresh = false }: { fresh?: boolean } = {}) {
  const session = await getSession({ fresh });
  if (!session) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  };
}

/**
 * Use this in every server component, route handler and server action that
 * touches user data. proxy.ts only does a quick cookie check; this is the
 * real check against the database.
 */
export async function requireUser({ fresh = false }: { fresh?: boolean } = {}) {
  const user = await getUserOrNull({ fresh });
  if (!user) redirect("/login");
  return user;
}
