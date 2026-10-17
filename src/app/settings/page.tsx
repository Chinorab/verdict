import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAll } from "@/components/DeleteAll";
import { Disclaimer, Header } from "@/components/ui";
import { DataControls } from "./DataControls";

export const metadata: Metadata = { title: "Your data" };

/* Data controls: backup export and import, delete everything. */
export default function SettingsPage() {
  return (
    <div className="app-column">
      <Header title="Your data" backHref="/" />
      <main style={{ padding: "0 var(--gutter) 28px", flex: 1, display: "flex", flexDirection: "column" }}>
        <section style={{ padding: "28px 0", display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontSize: "var(--fs-h1)", fontWeight: 400, letterSpacing: "-0.5px", lineHeight: 1.15 }}>
            Delete everything
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: 15 }}>
            Removes every trial, photo and measurement from this phone. You confirm first. It cannot be undone.
          </p>
          <DeleteAll />
          <Link href="/privacy" style={{ minHeight: 44, display: "flex", alignItems: "center", fontSize: 14 }}>
            How Verdict handles your data
          </Link>
        </section>
        <DataControls />
        <div style={{ marginTop: "auto" }}>
          <Disclaimer />
        </div>
      </main>
    </div>
  );
}
