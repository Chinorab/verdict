"use client";

import { useEffect, useState } from "react";
import { errorCopy } from "@/lib/copy";
import { probeStorage } from "@/lib/db";
import { Icon } from "./Icon";

/* Warns when this browser will not keep trials (private mode, blocked site data). T060. */
export function StorageWarning() {
  const [ok, setOk] = useState(true);

  useEffect(() => {
    let live = true;
    probeStorage().then((v) => live && setOk(v), () => live && setOk(false));
    return () => {
      live = false;
    };
  }, []);

  if (ok) return null;
  const copy = errorCopy("storage_unavailable");
  return (
    <div
      role="status"
      style={{
        display: "grid",
        gridTemplateColumns: "20px 1fr",
        gap: 10,
        padding: "12px var(--gutter)",
        background: "var(--paper)",
        borderBottom: "1px solid var(--deadline)",
        color: "var(--text)",
        fontSize: 14,
        lineHeight: 1.45,
      }}
    >
      <Icon name="warning" size={20} style={{ color: "var(--deadline)" }} />
      <p>
        <strong style={{ fontWeight: 500 }}>{copy.title}</strong> {copy.action}
      </p>
    </div>
  );
}
