import { NextResponse } from "next/server";
import { deleteDocument, getDocument } from "@/lib/documents/store";
import { getUserOrNull } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, { params }: Context) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Please sign in.", 401);

  const { id } = await params;
  const document = await getDocument(user.id, id);
  if (!document) return errorResponse("Document not found.", 404);

  return NextResponse.json({ document });
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Please sign in.", 401);

  const { id } = await params;
  const deleted = await deleteDocument(user.id, id);
  if (!deleted) return errorResponse("Document not found.", 404);

  return NextResponse.json({ ok: true });
}
