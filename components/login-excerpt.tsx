// A static preview of the product's core idea: a passage with the sentence
// that answers the question marked in highlighter yellow, and a citation chip.
export function LoginExcerpt() {
  return (
    <div className="w-full max-w-lg">
      <div className="rounded-[14px] border border-line bg-ink p-7">
        <div className="flex items-baseline justify-between gap-4 text-sm text-muted">
          <span className="font-medium text-text">Q3-report.pdf</span>
          <span>Page 8</span>
        </div>
        <p className="mt-5 font-serif text-[17px] leading-[1.75] text-text/90">
          Operating costs rose 6% over the quarter.{" "}
          <span className="mark">
            Most of the increase came from cloud infrastructure after the APAC
            expansion,
          </span>{" "}
          while headcount stayed flat. Management expects margins to recover in
          Q4 as the new regions reach steady usage.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <div className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-raised px-4 py-2.5 text-[15px]">
          Why did costs go up?
        </div>
        <div className="max-w-[90%] rounded-xl rounded-bl-sm border border-line px-4 py-2.5 text-[15px] leading-relaxed">
          Mostly cloud infrastructure, after the APAC expansion.
          <span className="ml-2 inline-block rounded-[4px] bg-mark px-1.5 py-px align-middle text-xs font-semibold text-on-mark">
            p.8
          </span>
        </div>
      </div>
    </div>
  );
}
