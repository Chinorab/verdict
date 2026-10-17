"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header, SameDayBadge } from "@/components/ui";
import { errorCopy } from "@/lib/copy";
import { quickPlan, todayIso, type TrialPlan } from "@/lib/schedule";
import { createTrial } from "@/lib/trial-actions";
import { ClaimsStep } from "./ClaimsStep";
import { fromReading, needsJamaNote, type Draft } from "./draft";
import { ScanStep } from "./ScanStep";

const empty = (): Draft => ({
  product: { name: "", size: "" },
  claims: [],
  purchase: { price: "", date: todayIso(), retailer: "", online: false, returnDays: 30 },
});

/** A quick run needs three analyses: two for day 0 and one immediate check-in (FR-035b). */
const QUICK_ANALYSES = 3;

export function NewTrial({ quick = false }: { quick?: boolean }) {
  const router = useRouter();
  const [blocked, setBlocked] = useState<{ title: string; action: string } | null>(null);

  // Budget pre check before a quick run (T063): say it now rather than after day 0.
  useEffect(() => {
    if (!quick) return;
    let live = true;
    fetch("/api/budget", { cache: "no-store" })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!live) return;
        if (!ok) setBlocked(errorCopy("unavailable"));
        else if (!j.globalOpen) setBlocked(errorCopy("cap_global", j.resumesAt));
        else if (j.deviceRemaining < QUICK_ANALYSES) setBlocked(errorCopy("cap_device", j.resumesAt));
      })
      .catch(() => live && setBlocked(errorCopy("network")));
    return () => {
      live = false;
    };
  }, [quick]);
  const [step, setStep] = useState<"scan" | "claims">("scan");
  const [draft, setDraft] = useState<Draft>(empty);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  async function confirm(plan: TrialPlan) {
    setSaving(true);
    setSaveError(false);
    try {
      const id = await createTrial({
        kind: quick ? "quick" : "real",
        product: { name: draft.product.name, size: draft.product.size || undefined },
        purchase: {
          price: Math.round(Number(draft.purchase.price) * 100) / 100,
          currency: "USD",
          date: draft.purchase.date,
          retailer: draft.purchase.retailer.trim(),
          online: draft.purchase.online,
          returnDays: draft.purchase.returnDays ?? 30,
        },
        plan: quick
          ? quickPlan({ start: todayIso(), purchaseDate: draft.purchase.date, returnDays: draft.purchase.returnDays ?? 30 })
          : plan,
        claims: draft.claims.map((c) => ({
          text: c.text,
          timeframeDays: c.timeframeDays,
          targets: c.targets,
          measurable: c.measurable,
          unmeasurableReason: c.unmeasurableReason,
          main: c.main,
          healthTerms: c.healthTerms,
          fastPromise: c.fastPromise,
          editedByUser: c.editedByUser,
        })),
        jamaNoteShown: needsJamaNote(draft),
      });
      router.push(`/trial/${id}/capture`);
    } catch {
      setSaving(false);
      setSaveError(true);
    }
  }

  return (
    <div className="app-column">
      <Header
        title={quick ? "Same day test" : "New trial"}
        backHref={step === "scan" ? "/" : undefined}
        right={<span className="num">{step === "scan" ? "1/3" : "2/3"}</span>}
      />
      {quick && (
        <div style={{ padding: "16px var(--gutter) 0", display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
          <SameDayBadge />
          <p style={{ fontSize: 14, color: "var(--text-2)" }}>
            A same day test runs the whole trial in one sitting: two day 0 photos, one more photo right after, then a
            result. Real changes take weeks, so expect no measurable change.
          </p>
        </div>
      )}
      {blocked && (
        <p role="alert" style={{ margin: "16px var(--gutter) 0", padding: "12px 0", borderTop: "2px solid var(--deadline)", fontSize: 14 }}>
          <strong style={{ fontWeight: 500 }}>{blocked.title}</strong> {blocked.action}
        </p>
      )}
      {step === "scan" ? (
        <ScanStep
          onRead={(r) => {
            setDraft((d) => ({ ...d, ...fromReading(r) }));
            setStep("claims");
          }}
          onTypeInstead={() => setStep("claims")}
        />
      ) : (
        <>
          <div style={{ padding: "8px var(--gutter) 0" }}>
            <button
              type="button"
              onClick={() => setStep("scan")}
              style={{ background: "none", border: 0, padding: 0, minHeight: 44, color: "var(--accent)", cursor: "pointer", fontSize: 14 }}
            >
              Scan the label again
            </button>
          </div>
          <ClaimsStep draft={draft} onChange={setDraft} onConfirm={confirm} saving={saving} disabled={!!blocked} quick={quick} />
          {saveError && (
            <p role="alert" style={{ padding: "0 var(--gutter) 24px", color: "var(--deadline)", fontSize: 14 }}>
              The trial could not be saved on this device. Check that this browser allows site data, then try again.
            </p>
          )}
        </>
      )}
    </div>
  );
}
