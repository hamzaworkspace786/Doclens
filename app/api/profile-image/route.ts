import { getUserOrNull } from "@/lib/session";

export async function GET() {
  const user = await getUserOrNull({ fresh: true });
  if (!user) return new Response("Please sign in.", { status: 401 });
  if (!user.image) return new Response("Profile image not found.", { status: 404 });

  let imageUrl: URL;
  try {
    imageUrl = new URL(user.image);
  } catch {
    console.error("The profile image URL is invalid.");
    return new Response("Profile image unavailable.", { status: 502 });
  }

  if (
    imageUrl.protocol !== "https:" ||
    !imageUrl.hostname.endsWith(".googleusercontent.com") ||
    imageUrl.username ||
    imageUrl.password
  ) {
    console.error("The profile image URL uses an unsupported host.");
    return new Response("Profile image unavailable.", { status: 502 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(imageUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("Profile image request failed:", error);
    return new Response("Profile image unavailable.", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type");
  if (!upstream.ok || !contentType?.startsWith("image/") || !upstream.body) {
    console.error("The profile image provider returned an invalid response.", {
      status: upstream.status,
      contentType,
    });
    return new Response("Profile image unavailable.", { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
