/* The Verdict mark from design/project/Favicon.dc.html: a V set on a measuring rule. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" fill="#141716" />
      <path d="M9 7.5l7 14 7-14" fill="none" stroke="#F3F4F1" strokeWidth="3" strokeLinecap="square" />
      <path d="M8 26h16" stroke="#7C93FF" strokeWidth="2.5" />
    </svg>
  );
}
