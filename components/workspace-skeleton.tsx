import { Logo } from "./logo";

// Shown while the session is checked. Same frame as the real workspace, so
// nothing jumps when it loads.
export function WorkspaceSkeleton() {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-line px-4">
        <Logo />
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        <div className="hidden rounded-[14px] border border-line bg-panel lg:block" />
        <div className="rounded-[14px] border border-line bg-panel" />
        <div className="hidden rounded-[14px] border border-line bg-panel lg:block" />
      </div>
    </div>
  );
}
