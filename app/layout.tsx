import type { Metadata } from "next";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/source-serif-4";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DocLens", template: "%s | DocLens" },
  description:
    "Upload a document, get a summary, and ask it questions. Every answer points to the page it came from.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
