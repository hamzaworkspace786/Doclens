"use client";

import { useState } from "react";
import { useDocumentChat } from "@/lib/use-chat";
import { useDocuments } from "@/lib/use-documents";
import type { PageRequest } from "@/lib/types";
import { AnalysisPanel } from "./analysis-panel";
import { ChatPanel } from "./chat-panel";
import { DocRail } from "./doc-rail";
import { Logo } from "./logo";
import { UserMenu } from "./user-menu";

type PanelId = "documents" | "analysis" | "chat";

const panelTabs: { id: PanelId; label: string }[] = [
  { id: "documents", label: "Documents" },
  { id: "analysis", label: "Analysis" },
  { id: "chat", label: "Chat" },
];

const panelClass =
  "min-h-0 overflow-hidden rounded-[14px] border border-line bg-panel lg:block";

export function WorkspaceShell({
  user,
}: {
  user: { name: string; email: string; image: string | null };
}) {
  // On small screens only one panel shows at a time. From lg up, all three do.
  const [active, setActive] = useState<PanelId>("analysis");
  const library = useDocuments();
  const chat = useDocumentChat();
  const [pageRequest, setPageRequest] = useState<PageRequest | null>(null);

  const selectedDocument =
    library.documents.find((doc) => doc.id === library.selectedId) ?? null;

  // A page cited in the chat opens in the Text tab of the analysis panel.
  function openCitedPage(page: number) {
    if (!selectedDocument) return;
    setPageRequest((previous) => ({
      documentId: selectedDocument.id,
      page,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
    setActive("analysis");
  }

  function handleSelect(id: string) {
    library.selectDocument(id);
    setActive("analysis");
  }

  async function handleUpload(files: File[]) {
    const created = await library.uploadFiles(files);
    if (created.length > 0) setActive("analysis");
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
        <Logo />
        <UserMenu name={user.name} email={user.email} image={user.image} />
      </header>

      <div
        role="tablist"
        aria-label="Workspace panels"
        className="flex shrink-0 border-b border-line lg:hidden"
      >
        {panelTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={`-mb-px flex-1 border-b-2 py-2.5 text-sm ${
              active === tab.id
                ? "border-mark font-medium text-text"
                : "border-transparent text-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        <section
          aria-label="Documents"
          className={`${panelClass} ${active === "documents" ? "block" : "hidden"}`}
        >
          <DocRail
            documents={library.documents}
            loading={library.loading}
            loadError={library.loadError}
            selectedId={library.selectedId}
            uploadingNames={library.uploadingNames}
            uploadError={library.uploadError}
            onSelect={handleSelect}
            onUpload={handleUpload}
            onDelete={library.deleteDocument}
          />
        </section>
        <section
          aria-label="Analysis"
          className={`${panelClass} ${active === "analysis" ? "block" : "hidden"}`}
        >
          <AnalysisPanel
            document={selectedDocument}
            onAnalyze={library.analyzeDocument}
            pageRequest={pageRequest}
          />
        </section>
        <section
          aria-label="Chat"
          className={`${panelClass} ${active === "chat" ? "block" : "hidden"}`}
        >
          <ChatPanel document={selectedDocument} chat={chat} onOpenPage={openCitedPage} />
        </section>
      </main>
    </div>
  );
}
