import { SOURCES } from "@/lib/sources";
import { Icon } from "./Icon";
import s from "./SourcedNote.module.css";

/* FR-028: informational, never a diagnosis. Shown for online purchases with fast promises on
   eczema, psoriasis or dark spots. */
export function JamaNote() {
  const src = SOURCES.undeclaredActives;
  return (
    <aside className={s.note} aria-label="Good to know before you start">
      <Icon name="info" size={20} />
      <div className={s.body}>
        <p>
          Researchers bought {src.tested} skin products sold online for eczema, psoriasis, dermatitis or dark spots. {src.found} of
          them contained a strong prescription steroid that was not on the label.
        </p>
        <p className={s.muted}>
          If this product promises fast results on one of these, check where it comes from. When in doubt, ask a
          pharmacist before using it.
        </p>
        <a href={src.url} target="_blank" rel="noopener noreferrer" className={s.source}>
          {src.label}
        </a>
      </div>
    </aside>
  );
}
