import {
  ArrowRight,
  ArrowsLeftRight,
  Bell,
  Calendar,
  Camera,
  CaretLeft,
  Check,
  Clock,
  Compass,
  Copy,
  Download,
  FrameCorners,
  House,
  Image as ImageIcon,
  Info,
  Lock,
  Prohibit,
  ShareNetwork,
  Sun,
  Trash,
  UploadSimple,
  Warning,
  X,
} from "@phosphor-icons/react/ssr";
import type { IconProps } from "@phosphor-icons/react";

// One icon family (Phosphor, light weight) for the whole app. Names follow what the mockups show.
const ICONS = {
  arrow: ArrowRight,
  back: CaretLeft,
  close: X,
  check: Check,
  lock: Lock,
  info: Info,
  clock: Clock,
  bell: Bell,
  camera: Camera,
  upload: UploadSimple,
  compare: ArrowsLeftRight,
  light: Sun,
  framing: FrameCorners,
  angle: Compass,
  noMakeup: Prohibit,
  room: House,
  hour: Clock,
  notMeasurable: Prohibit,
  warning: Warning,
  calendar: Calendar,
  download: Download,
  share: ShareNetwork,
  copy: Copy,
  trash: Trash,
  image: ImageIcon,
} as const;

export type IconName = keyof typeof ICONS;

type Props = Omit<IconProps, "ref"> & {
  name: IconName;
  /** Accessible label. Without it the icon is decorative and hidden from assistive tech. */
  label?: string;
};

export function Icon({ name, label, size = 20, weight = "light", ...rest }: Props) {
  const Glyph = ICONS[name];
  return label ? (
    <Glyph size={size} weight={weight} role="img" aria-label={label} {...rest} />
  ) : (
    <Glyph size={size} weight={weight} aria-hidden="true" focusable="false" {...rest} />
  );
}
