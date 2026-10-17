"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Icon } from "./Icon";

// Read once when the page loads after "Delete all trial data" (?erased=1).
const erasedAtLoad = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("erased") === "1";
const noop = () => () => {};

/* Confirms the deletion after the full reload it triggers. */
export function ErasedNotice() {
  const show = useSyncExternalStore(noop, () => erasedAtLoad, () => false);

  useEffect(() => {
    if (show) window.history.replaceState(null, "", window.location.pathname);
  }, [show]);

  if (!show) return null;
  return (
    <p role="status" style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text)" }}>
      <Icon name="check" size={18} weight="regular" style={{ color: "var(--accent)" }} />
      Everything Verdict kept on this phone was deleted.
    </p>
  );
}
