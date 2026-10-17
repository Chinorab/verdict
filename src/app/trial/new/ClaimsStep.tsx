"use client";

import { useId, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { JamaNote } from "@/components/SourcedNote";
import { CtaButton, Field, SecondaryButton, Segmented } from "@/components/ui";
import { fmtDate, plural } from "@/lib/format";
import { daysBetween, planTrial, todayIso, type TrialPlan } from "@/lib/schedule";
import { CONCERN_LABEL, CONCERNS, type Concern } from "@/lib/schemas";
import { needsJamaNote, typedClaim, withDefaultMain, type Draft, type DraftClaim } from "./draft";
import s from "./new.module.css";

const WINDOWS = [14, 30, 60, 90, 0] as const; // 0 = other

/* Step 2 of 3 (design/project/Claims.dc.html): what it promises, how we check, the purchase. */
export function ClaimsStep({
  draft,
  onChange,
  onConfirm,
  saving,
  quick = false,
  disabled = false,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onConfirm: (plan: TrialPlan) => void;
  saving: boolean;
  quick?: boolean;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(draft.claims.length === 0 ? "new" : null);
  const [nameEditing, setNameEditing] = useState(!draft.product.name);
  const [otherDays, setOtherDays] = useState(
    draft.purchase.returnDays && !WINDOWS.includes(draft.purchase.returnDays as 14) ? String(draft.purchase.returnDays) : "",
  );
  const [touched, setTouched] = useState(false);
  const p = draft.purchase;
  const today = todayIso();

  const measurable = draft.claims.filter((c) => c.measurable);
  const plan = useMemo(() => {
    if (!p.returnDays || !p.date) return null;
    return planTrial({
      start: today,
      purchaseDate: p.date,
      returnDays: p.returnDays,
      claimTimeframes: measurable.map((c) => c.timeframeDays),
    });
  }, [p.returnDays, p.date, today, measurable]);

  const errors = {
    name: !draft.product.name.trim() ? "Enter the product name." : undefined,
    claims: measurable.length === 0 ? "Add at least one claim a photo can measure." : undefined,
    price: p.price === "" || !(Number(p.price) >= 0) ? "Enter what you paid." : undefined,
    date: !p.date || p.date > today ? "Enter the purchase date." : undefined,
    window: !p.returnDays || p.returnDays < 1 || p.returnDays > 365 ? "Pick the return window." : undefined,
  };
  const valid = !Object.values(errors).some(Boolean);

  const setPurchase = (patch: Partial<Draft["purchase"]>) => onChange({ ...draft, purchase: { ...p, ...patch } });
  const setClaims = (claims: DraftClaim[]) => onChange({ ...draft, claims: withDefaultMain(claims) });

  const windowValue = p.returnDays === null ? null : WINDOWS.includes(p.returnDays as 14) ? p.returnDays : 0;

  return (
    <main className={s.main}>
      <section className={s.intro}>
        <span className={s.meta}>Product</span>
        {nameEditing ? (
          <Field
            id="product-name"
            label="Product name"
            value={draft.product.name}
            autoComplete="off"
            onChange={(e) => onChange({ ...draft, product: { ...draft.product, name: e.target.value } })}
            onBlur={() => draft.product.name.trim() && setNameEditing(false)}
            error={touched ? errors.name : undefined}
          />
        ) : (
          <div className={s.productRow}>
            <h1 className={s.h1}>{draft.product.name}</h1>
            <button type="button" className={s.link} onClick={() => setNameEditing(true)}>
              Edit
            </button>
          </div>
        )}
        {draft.product.size && <span className={`${s.meta} num`}>{draft.product.size}, read from the label</span>}
      </section>

      <section className={s.section} aria-labelledby="claims-h">
        <h2 id="claims-h" className={s.h2}>
          What it promises, and how we check
        </h2>
        <ol className={s.claimList}>
          {draft.claims.map((c) =>
            editing === c.key ? (
              <li key={c.key}>
                <ClaimEditor
                  claim={c}
                  onSave={(next) => {
                    setClaims(draft.claims.map((x) => (x.key === c.key ? next : x)));
                    setEditing(null);
                  }}
                  onRemove={() => {
                    setClaims(draft.claims.filter((x) => x.key !== c.key));
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <ClaimRow
                key={c.key}
                claim={c}
                verdictDate={plan?.verdictDate}
                onMain={() => setClaims(draft.claims.map((x) => ({ ...x, main: x.key === c.key })))}
                onEdit={() => setEditing(c.key)}
              />
            ),
          )}
          {editing === "new" && (
            <li>
              <ClaimEditor
                onSave={(next) => {
                  setClaims([...draft.claims, next]);
                  setEditing(null);
                }}
                onCancel={draft.claims.length ? () => setEditing(null) : undefined}
              />
            </li>
          )}
        </ol>
        {editing === null && (
          <div>
            <SecondaryButton onClick={() => setEditing("new")}>Add a claim</SecondaryButton>
          </div>
        )}
        {touched && errors.claims && <p className={s.formError}>{errors.claims}</p>}
      </section>

      <section className={s.section} aria-labelledby="buy-h">
        <h2 id="buy-h" className={s.h2}>
          Purchase
        </h2>
        <div className={s.grid2}>
          <Field
            id="price"
            label="Price paid, $"
            inputMode="decimal"
            autoComplete="off"
            className="num"
            value={p.price}
            onChange={(e) => setPurchase({ price: e.target.value.replace(/[^0-9.]/g, "") })}
            error={touched ? errors.price : undefined}
          />
          <Field
            id="date"
            label="Bought on"
            type="date"
            max={today}
            value={p.date}
            onChange={(e) => setPurchase({ date: e.target.value })}
            error={touched ? errors.date : undefined}
          />
        </div>
        <Field
          id="retailer"
          label="Retailer"
          placeholder="Store or website…"
          autoComplete="off"
          value={p.retailer}
          onChange={(e) => setPurchase({ retailer: e.target.value })}
        />
        <label className={s.check}>
          <input type="checkbox" checked={p.online} onChange={(e) => setPurchase({ online: e.target.checked })} />
          Bought online
        </label>
        <Segmented
          legend="Return window, in days"
          options={WINDOWS}
          value={windowValue as (typeof WINDOWS)[number] | null}
          format={(v) => (v === 0 ? "Other" : String(v))}
          onChange={(v) => setPurchase({ returnDays: v === 0 ? (Number(otherDays) || null) : v })}
        />
        {windowValue === 0 && (
          <Field
            id="other-days"
            label="Return window, days"
            inputMode="numeric"
            className="num"
            value={otherDays}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 3);
              setOtherDays(v);
              setPurchase({ returnDays: Number(v) || 0 });
            }}
          />
        )}
        {touched && errors.window && <p className={s.formError}>{errors.window}</p>}

        {plan && !quick && <PlanCallout plan={plan} />}
        {plan?.timeframeWarning && !quick && (
          <p className={s.small}>
            The label promises results over a longer time than your return window allows. Your verdict will come
            earlier than that promise, and will say so.
          </p>
        )}
        {needsJamaNote(draft) && <JamaNote />}
        <p className={s.small}>Check the retailer&apos;s policy. Some only accept unopened products.</p>
      </section>

      <div className={s.ctaWrap}>
        <CtaButton
          disabled={saving || disabled}
          onClick={() => {
            setTouched(true);
            if (valid && plan) onConfirm(plan);
            // Move focus to the first field with an error once it renders.
            else requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
          }}
        >
          {saving ? "Saving…" : "Start day 0 photos"}
        </CtaButton>
        {touched && !valid && <p className={s.formError}>Complete the fields marked above.</p>}
      </div>
    </main>
  );
}

function PlanCallout({ plan }: { plan: TrialPlan }) {
  return (
    <div className={s.callout} aria-live="polite">
      <Icon name="clock" />
      {plan.tooLate ? (
        <p className={s.warning}>
          The return window closes on <strong className="num">{fmtDate(plan.deadline)}</strong>, too soon for a
          verdict. You can still run a trial; it will not suggest keeping or returning.
        </p>
      ) : (
        <p>
          Return by <strong className="num">{fmtDate(plan.deadline)}</strong>. Your verdict is scheduled for{" "}
          <strong className="num">{fmtDate(plan.verdictDate)}</strong>, {plural(daysBetween(plan.verdictDate, plan.deadline), "day")} before.
        </p>
      )}
    </div>
  );
}

function ClaimRow({
  claim,
  verdictDate,
  onMain,
  onEdit,
}: {
  claim: DraftClaim;
  verdictDate?: string;
  onMain: () => void;
  onEdit: () => void;
}) {
  const concerns = claim.targets.map((t) => CONCERN_LABEL[t.concern]).join(" and ");
  return (
    <li className={`${s.claim} ${claim.measurable ? "" : s.claimMuted}`}>
      <span className={s.claimText}>&ldquo;{claim.text}&rdquo;</span>
      {claim.measurable ? (
        <span className={s.mapping}>
          <Icon name="arrow" size={16} />
          {concerns}
          {claim.main && verdictDate ? `, judged on ${fmtDate(verdictDate)}` : ""}
        </span>
      ) : (
        <span className={s.mapping}>
          <Icon name="notMeasurable" size={16} />
          {claim.unmeasurableReason} Left out of the verdict.
        </span>
      )}
      <div className={s.claimActions}>
        {claim.measurable && (
          <label className={s.radio}>
            <input type="radio" name="main-claim" checked={claim.main} onChange={onMain} />
            Main claim
          </label>
        )}
        <button type="button" className={s.link} onClick={onEdit}>
          Edit
        </button>
      </div>
    </li>
  );
}

function ClaimEditor({
  claim,
  onSave,
  onRemove,
  onCancel,
}: {
  claim?: DraftClaim;
  onSave: (c: DraftClaim) => void;
  onRemove?: () => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const [text, setText] = useState(claim?.text ?? "");
  const [weeks, setWeeks] = useState(claim?.timeframeDays ? String(Math.round(claim.timeframeDays / 7) || 1) : "");
  const [concerns, setConcerns] = useState<Concern[]>(claim?.targets.map((t) => t.concern) ?? []);
  const [error, setError] = useState<string>();

  const toggle = (c: Concern) =>
    setConcerns((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : cur.length >= 2 ? cur : [...cur, c]));

  function save() {
    if (!text.trim()) return setError("Type the claim as printed.");
    const days = weeks ? Math.min(Number(weeks) * 7, 365) : null;
    const base = typedClaim(text.trim(), concerns, days);
    if (claim) {
      // Keep the reader's directions for concerns that were already mapped.
      const targets = base.targets.map((t) => claim.targets.find((o) => o.concern === t.concern) ?? t);
      onSave({
        ...claim,
        text: base.text,
        timeframeDays: days,
        targets,
        measurable: targets.length > 0,
        unmeasurableReason: targets.length ? null : claim.unmeasurableReason ?? base.unmeasurableReason,
        fastPromise: claim.fastPromise || base.fastPromise,
        healthTerms: [...new Set([...claim.healthTerms, ...base.healthTerms])],
        main: targets.length ? claim.main : false,
        editedByUser: true,
      });
    } else onSave(base);
  }

  return (
    <div className={s.editor}>
      <Field
        id={`${id}-text`}
        label="Claim, as printed"
        value={text}
        maxLength={200}
        onChange={(e) => setText(e.target.value)}
        error={error}
      />
      <Field
        id={`${id}-weeks`}
        label="Promised in how many weeks? Leave empty if not printed"
        inputMode="numeric"
        className="num"
        value={weeks}
        onChange={(e) => setWeeks(e.target.value.replace(/\D/g, "").slice(0, 2))}
      />
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className={s.meta} style={{ marginBottom: 8 }}>
          What a photo can check for it (up to two). None means not measurable.
        </legend>
        <div className={s.chips}>
          {CONCERNS.map((c) => (
            <button key={c} type="button" className={s.chip} aria-pressed={concerns.includes(c)} onClick={() => toggle(c)}>
              {CONCERN_LABEL[c]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className={s.editorRow}>
        <SecondaryButton onClick={save}>Save claim</SecondaryButton>
        {onCancel && (
          <button type="button" className={s.link} onClick={onCancel}>
            Cancel
          </button>
        )}
        {onRemove && (
          <button type="button" className={s.link} onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
