"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CtaLink } from "@/components/ui";
import { DEMO_ID, loadDemo } from "@/lib/demo";

/* Opens the author's demo trial, read only. */
export function DemoEntry() {
  const router = useRouter();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    loadDemo().then((id) => {
      if (!live) return;
      if (id) router.replace(`/trial/${DEMO_ID}/verdict`);
      else setMissing(true);
    });
    return () => {
      live = false;
    };
  }, [router]);

  if (!missing) return <p style={{ padding: "40px 0", color: "var(--text-2)" }}>Opening the demo trial…</p>;
  return (
    <div style={{ padding: "40px 0", display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ color: "var(--text-2)" }}>
        The author&apos;s real trial is still running. Its results appear here once the last check-in is done.
      </p>
      <CtaLink href="/trial/new?quick=1">Try a same day test instead</CtaLink>
    </div>
  );
}
