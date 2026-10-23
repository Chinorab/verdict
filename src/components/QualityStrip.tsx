import { Icon, type IconName } from "@/components/Icon";
import type { Indicator, QualityView } from "@/lib/camera-kit";
import s from "@/app/trial/[id]/capture/capture.module.css";

/* The three live indicators of the capture mockup: Light, Framing, Angle. */
export function QualityStrip({ view }: { view: QualityView }) {
  return (
    <ul className={s.strip} aria-live="polite">
      <Item name="Light" icon="light" value={view.light} />
      <Item name="Framing" icon="framing" value={view.framing} />
      <Item name="Angle" icon="angle" value={view.angle} />
    </ul>
  );
}

function Item({ name, icon, value }: { name: string; icon: IconName; value: Indicator }) {
  return (
    <li className={s.stripItem}>
      <span className={s.stripName}>
        <Icon name={icon} size={14} />
        {name}
      </span>
      <span className={`${s.stripValue} ${s[value.state]}`}>
        {value.state === "ok" && <Icon name="check" size={14} weight="bold" />}
        {value.state === "fix" && <Icon name="warning" size={14} />}
        {value.label}
      </span>
    </li>
  );
}
