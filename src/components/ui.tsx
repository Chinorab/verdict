import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Icon } from "./Icon";
import s from "./ui.module.css";

/* Header: back link, centered title, optional right slot (step counter or action). */
export function Header({
  title,
  backHref,
  backLabel = "Back",
  right,
}: {
  title: ReactNode;
  backHref?: string;
  backLabel?: string;
  right?: ReactNode;
}) {
  return (
    <header className={s.header}>
      {backHref ? (
        <Link href={backHref} aria-label={backLabel} className={s.headerBack}>
          <Icon name="back" />
        </Link>
      ) : (
        <span />
      )}
      <span className={s.headerTitle}>{title}</span>
      <span className={s.headerRight}>{right}</span>
    </header>
  );
}

/* Primary CTA as a link or a button. Label left, arrow right, square, ink fill. */
type CtaBase = { children: ReactNode; compact?: boolean; arrow?: boolean };
export function CtaLink({
  href,
  children,
  compact,
  arrow = true,
  ...rest
}: CtaBase & { href: string } & Omit<ComponentPropsWithoutRef<typeof Link>, "href" | "children">) {
  return (
    <Link href={href} className={`${s.cta} ${compact ? s.ctaCompact : ""}`} {...rest}>
      <span>{children}</span>
      {arrow && <Icon name="arrow" />}
    </Link>
  );
}

export function CtaButton({
  children,
  compact,
  arrow = true,
  type = "button",
  ...rest
}: CtaBase & ComponentPropsWithoutRef<"button">) {
  return (
    <button type={type} className={`${s.cta} ${compact ? s.ctaCompact : ""}`} {...rest}>
      <span>{children}</span>
      {arrow && <Icon name="arrow" />}
    </button>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={s.secondary} style={{ height: "var(--cta-h)" }}>
      {children}
    </Link>
  );
}

export function SecondaryButton({ children, type = "button", ...rest }: ComponentPropsWithoutRef<"button">) {
  return (
    <button type={type} className={s.secondary} {...rest}>
      {children}
    </button>
  );
}

/* Segmented control; values are numbers or short strings. */
export function Segmented<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  format = (v) => String(v),
}: {
  legend: string;
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <fieldset className={s.segmented}>
      <legend className={s.segLegend}>{legend}</legend>
      <div className={s.segRow}>
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            className={s.segBtn}
            aria-pressed={o === value}
            onClick={() => onChange(o)}
          >
            {format(o)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/* Field: label above the input, hint and error below. */
export function Field({
  id,
  label,
  hint,
  error,
  ...input
}: { id: string; label: string; hint?: string; error?: string } & ComponentPropsWithoutRef<"input">) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.fieldLabel}>
        {label}
      </label>
      <input
        id={id}
        name={input.name ?? id}
        className={s.fieldInput}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {hint && (
        <span id={`${id}-hint`} className={s.fieldHint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className={s.fieldError}>
          {error}
        </span>
      )}
    </div>
  );
}

/* Shown on every screen with measurements (FR-029). */
export function Disclaimer({ children }: { children?: ReactNode }) {
  return (
    <p className={s.disclaimer}>
      <Icon name="info" size={16} />
      <span>{children ?? "Indicative results, not medical advice."}</span>
    </p>
  );
}

/* Marks every screen of a quick run (FR-035b). */
export function SameDayBadge() {
  return <span className={s.badge}>Same day test</span>;
}
