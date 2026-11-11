import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** For API route handlers: returns null instead of redirecting, so you can answer 401. */
export async function getUserOrNull() {
  const session = await getSession();
  if (!session) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  };
}

/**
 * Use this in every server component, route handler and server action that
 * touches user data. proxy.ts only does a quick cookie check; this is the
 * real check against the database.
 */
export async function requireUser() {
  const user = await getUserOrNull();
  if (!user) redirect("/login");
  return user;
}
