"use client";

import { useEffect, useState } from "react";
import { demoLabel } from "@/lib/demo";
import type { Trial } from "@/lib/schemas";

/* Marks every demo screen as the author's real trial, with its real dates (FR-035). */
export function DemoBanner({ trial }: { trial: Trial }) {
  const [label, setLabel] = useState("Real trial by the author");
  useEffect(() => {
    let live = true;
    demoLabel(trial).then((l) => live && setLabel(l));
    return () => {
      live = false;
    };
  }, [trial]);
  return (
    <p
      role="note"
      style={{
        marginTop: 16,
        padding: "10px 12px",
        border: "1px solid var(--accent)",
        color: "var(--text)",
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      <strong style={{ fontWeight: 500, color: "var(--accent)" }}>{label}.</strong> Read only, measured on one person. No
      face photos are shared in this demo.
    </p>
  );
}
