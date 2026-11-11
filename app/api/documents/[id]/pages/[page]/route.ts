import { NextResponse } from "next/server";
import { getDocument, getPageText } from "@/lib/documents/store";
import { getUserOrNull } from "@/lib/session";
import type { PageContent } from "@/lib/types";

type Context = { params: Promise<{ id: string; page: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, { params }: Context) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Please sign in.", 401);

  const { id, page: pageParam } = await params;
  const page = Number(pageParam);
  if (!Number.isInteger(page) || page < 1) {
    return errorResponse("Page numbers start at 1.", 400);
  }

  const document = await getDocument(user.id, id);
  if (!document) return errorResponse("Document not found.", 404);

  const text = await getPageText(user.id, id, page);
  if (text === null) return errorResponse("Page not found.", 404);

  const body: PageContent = { page, pageCount: document.pageCount, text };
  return NextResponse.json(body);
}
