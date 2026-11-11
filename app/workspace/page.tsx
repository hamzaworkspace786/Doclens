import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { WorkspaceShell } from "@/components/workspace-shell";
import { WorkspaceSkeleton } from "@/components/workspace-skeleton";

export const metadata: Metadata = { title: "Workspace" };

// Reading the session is request-time work, so it streams in behind <Suspense>.
async function Workspace() {
  const user = await requireUser({ fresh: true });
  return (
    <WorkspaceShell
      user={{ name: user.name, email: user.email, image: user.image }}
    />
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <Workspace />
    </Suspense>
  );
}
