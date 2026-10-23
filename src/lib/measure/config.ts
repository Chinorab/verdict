import type { Concern } from "../schemas";

/*
  Measurement settings (research R9), explained in the README.
  - rawHigherMeansMore: MEASURED on 2026-10-22 (scripts/out/synthetic, HD v2.1): raw_score moved in
    the same direction as ui_score in 28 of 28 comparisons, so raw_score is a "higher is better"
    score. For problem concerns a higher raw score means LESS of the concern; for hydration,
    radiance and firmness it means MORE.
  - k and floor: DESIGN DEFAULTS (k = 1.5 from the mockups, a 1 point floor), not yet calibrated on
    real camera photos. Each person's threshold still comes from their own two day 0 photos.
  Set MEASURE_CONFIG back to null to make the app refuse to show results (constitution I and IV).
*/

export type MeasureConfig = {
  /** Threshold = max(k x day 0 noise, floor). */
  k: number;
  /** Smallest threshold per concern, in raw score units, so an identical pair cannot make every wobble count. */
  floor: Record<Concern, number>;
  /**
    Whether a higher raw_score means MORE of the concern as the app names it
    (more dark spots, more redness, more hydration...). Read from calibration by comparing
    raw and ui orderings; ui_score is higher when skin looks better.
  */
  rawHigherMeansMore: Record<Concern, boolean>;
  /** Where the numbers come from, shown in the README. */
  source: string;
};

export const MEASURE_CONFIG: MeasureConfig | null = {
  k: 1.5,
  floor: {
    age_spot: 1, wrinkle: 1, texture: 1, dark_circle: 1, redness: 1, pore: 1,
    acne: 1, oiliness: 1, moisture: 1, firmness: 1, radiance: 1, eye_bag: 1,
  },
  rawHigherMeansMore: {
    age_spot: false, wrinkle: false, texture: false, dark_circle: false, redness: false, pore: false,
    acne: false, oiliness: false, eye_bag: false,
    moisture: true, radiance: true, firmness: true,
  },
  source:
    "Directions measured 2026-10-22 on synthetic test faces (raw and ui scores agree 28 of 28). k = 1.5 and a 1 point floor are design defaults, not yet calibrated on real camera photos.",
};

export class NotCalibratedError extends Error {
  constructor() {
    super("Measurement settings are not calibrated yet (tasks T003, T004).");
  }
}

export function measureConfig(): MeasureConfig {
  if (!MEASURE_CONFIG) throw new NotCalibratedError();
  return MEASURE_CONFIG;
}
