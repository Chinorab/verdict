import type { Metadata } from "next";
import { Header } from "@/components/ui";
import { DemoEntry } from "./DemoEntry";

export const metadata: Metadata = { title: "Demo trial" };

export default function DemoPage() {
  return (
    <div className="app-column">
      <Header title="Demo trial" backHref="/" />
      <main style={{ padding: "0 var(--gutter)", flex: 1 }}>
        <DemoEntry />
      </main>
    </div>
  );
}
