export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 26 26"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="3.5"
          y="2.5"
          width="19"
          height="21"
          rx="4"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8 8.5h10M8 17.5h6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.55"
        />
        <rect x="7" y="11" width="12" height="4" rx="1" fill="#f4d35e" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">DocLens</span>
    </span>
  );
}
