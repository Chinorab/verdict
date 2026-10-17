import type { Metadata } from "next";
import { Header } from "@/components/ui";
import { SharedReview } from "./SharedReview";

export const metadata: Metadata = {
  title: "Measured review",
  description: "A skincare review built only from measurements of one person's skin.",
  robots: { index: false },
};

export default function SharedReviewPage() {
  return (
    <div className="app-column">
      <Header title="Measured review" backHref="/" backLabel="Verdict home" />
      <main style={{ padding: "0 var(--gutter)", flex: 1 }}>
        <SharedReview />
      </main>
    </div>
  );
}
