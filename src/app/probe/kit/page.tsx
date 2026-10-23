import type { Metadata } from "next";
import { Header } from "@/components/ui";
import { KitProbe } from "./KitProbe";

export const metadata: Metadata = { title: "Camera probe", robots: { index: false } };

/* Throwaway probe (T012): measures the real size of Camera Kit captures on a phone. Delete after use. */
export default function KitProbePage() {
  return (
    <div className="app-column">
      <Header title="Camera probe" backHref="/" />
      <main style={{ padding: "0 var(--gutter) 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ color: "var(--text-2)", fontSize: 15, paddingTop: 20 }}>
          Test page. The photo stays on this phone: nothing is uploaded or saved. Run each setup once, then copy
          the results.
        </p>
        <KitProbe />
      </main>
    </div>
  );
}
