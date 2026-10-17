import type { Concern } from "../schemas";

/*
  Measurement settings (research R9). Every value here comes from calibration on real captures
  (tasks T003, T004) and is explained in the README. Until calibration has run, the values are
  null and the app refuses to compute thresholds rather than use a guessed number
  (constitution I and IV).
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

export const MEASURE_CONFIG: MeasureConfig | null = null;

export class NotCalibratedError extends Error {
  constructor() {
    super("Measurement settings are not calibrated yet (tasks T003, T004).");
  }
}

export function measureConfig(): MeasureConfig {
  if (!MEASURE_CONFIG) throw new NotCalibratedError();
  return MEASURE_CONFIG;
}
