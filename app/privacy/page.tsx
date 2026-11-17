import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { DOCUMENT_RETENTION_DAYS, LIMITS } from "@/lib/constants";

export const metadata: Metadata = { title: "Privacy" };

const section = "mt-9";
const heading = "text-lg font-semibold";
const body = "mt-2 font-serif text-[17px] leading-[1.75] text-text/90";
const link = "underline decoration-mark underline-offset-4 hover:text-mark";

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-8">
      <div className="flex items-center justify-between">
        <Logo />
        <Link href="/login" className="text-sm text-muted hover:text-text">
          Back to DocLens
        </Link>
      </div>

      <h1 className="mt-12 text-3xl font-semibold">Privacy</h1>
      <p className={body}>
        DocLens is a portfolio project, built and run by one person on free services. This page
        says plainly what happens to what you put in it.
      </p>

      <section className={section}>
        <h2 className={heading}>Please don&rsquo;t upload anything confidential</h2>
        <p className={body}>
          Use documents you are happy to share with an AI service: public reports, articles,
          sample contracts, your own notes. Don&rsquo;t upload IDs, medical or financial records,
          or anything covered by a confidentiality agreement.
        </p>
      </section>

      <section className={section}>
        <h2 className={heading}>What DocLens stores</h2>
        <p className={body}>
          Your account (name, email, and a profile picture if you add one; your password is
          stored only as a hash, or you sign in with Google). For each document you upload: its
          text, the data used for search, the AI-written analysis, and your saved chat about it.
          Small counters record how many documents and questions you have used today, so fair-use
          limits work. They delete themselves within a day or two.
        </p>
      </section>

      <section className={section}>
        <h2 className={heading}>What is sent to Google&rsquo;s AI</h2>
        <p className={body}>
          To analyze a document, search it, and answer your questions, DocLens sends its text and
          your questions to Google&rsquo;s Gemini API. DocLens uses Google&rsquo;s free tier, and
          under the free tier&rsquo;s terms Google may use submitted content to improve its
          products, and people at Google may review it. Read{" "}
          <a
            className={link}
            href="https://ai.google.dev/gemini-api/terms"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google&rsquo;s Gemini API terms
          </a>{" "}
          if you want the details. This is the main reason for the advice above.
        </p>
      </section>

      <section className={section}>
        <h2 className={heading}>Who can see your documents</h2>
        <p className={body}>
          Other users can&rsquo;t: every request is checked against your account. The person who
          runs DocLens has technical access to the database, because that comes with running the
          service. DocLens is hosted on Vercel and stores data in MongoDB Atlas, and their logs
          can include technical details such as IP addresses.
        </p>
      </section>

      <section className={section}>
        <h2 className={heading}>How long it is kept, and deleting it</h2>
        <p className={body}>
          Documents are deleted automatically {DOCUMENT_RETENTION_DAYS} days after you upload
          them, together with their analysis and chat. You can delete any document yourself at
          any time from the document list, which removes all of that straight away. Your account
          stays until you ask for it to be deleted (see Contact).
        </p>
      </section>

      <section className={section}>
        <h2 className={heading}>Fair-use limits</h2>
        <p className={body}>
          Because the AI runs on free quotas, each person can upload {LIMITS.uploadsPerDay}{" "}
          documents and ask {LIMITS.questionsPerDay} questions per day, and the whole site has a
          daily allowance too. If it runs out, DocLens says so and works again the next day.
        </p>
      </section>

      <section className={section}>
        <h2 className={heading}>Cookies</h2>
        <p className={body}>
          One cookie keeps you signed in. There is no advertising and no tracking.
        </p>
      </section>

      <section className={section}>
        <h2 className={heading}>Contact</h2>
        <p className={body}>
          Questions, or want your account deleted? Message{" "}
          <a
            className={link}
            href="https://www.linkedin.com/in/hamzaakram786"
            target="_blank"
            rel="noopener noreferrer"
          >
            Hamza Akram on LinkedIn
          </a>{" "}
          or open an issue on{" "}
          <a
            className={link}
            href="https://github.com/hamzaworkspace786/Doclens"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          .
        </p>
      </section>

      <p className="mt-12 text-sm text-muted">Last updated: November 2026</p>
    </main>
  );
}
