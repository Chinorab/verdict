import type { Claim, Concern, Measurement, Trial } from "../schemas";
import type { Baseline } from "./baseline";
import type { MeasureConfig } from "./config";

/*
  Verdict per claim and the Keep / Return suggestion (FR-021 to FR-024, constitution I).
  Only raw scores; a change counts only beyond the threshold measured on day 0.
*/

export type TargetStatus = "holding_up" | "getting_worse" | "no_change" | "missing";

export type TargetResult = {
  concern: Concern;
  direction: "decrease" | "increase";
  status: TargetStatus;
  /** Latest raw minus the day 0 mean, in score points (signed as the score moves). */
  delta: number;
  /** Delta signed so that positive means toward what the claim promised. */
  toward: number;
  threshold: number;
  noise: number;
  /** |toward| / threshold, for "1.8 times your threshold". */
  ratio: number;
};

export type ClaimResult = {
  claimId: string;
  text: string;
  main: boolean;
  measurable: boolean;
  /** Worst first: getting_worse, then no_change or missing, then holding_up. */
  status: TargetStatus | "not_measured";
  targets: TargetResult[];
};

export type Suggestion = "keep" | "return" | "none";

/** +1 when the raw score moving up is toward the claim, -1 when it is away. */
export function towardSign(direction: "decrease" | "increase", rawHigherMeansMore: boolean): 1 | -1 {
  const moreIsPromised = direction === "increase";
  return moreIsPromised === rawHigherMeansMore ? 1 : -1;
}

export function judgeTarget(
  concern: Concern,
  direction: "decrease" | "increase",
  baseline: Baseline | undefined,
  latest: number | undefined,
  cfg: MeasureConfig,
): TargetResult {
  if (!baseline || latest === undefined || !Number.isFinite(latest)) {
    return { concern, direction, status: "missing", delta: 0, toward: 0, threshold: baseline?.threshold ?? 0, noise: baseline?.noise ?? 0, ratio: 0 };
  }
  const delta = latest - baseline.mean;
  const toward = delta * towardSign(direction, cfg.rawHigherMeansMore[concern]);
  const t = baseline.threshold;
  // Strictly beyond the threshold: a change equal to it is still inside the noise.
  const status: TargetStatus = toward > t ? "holding_up" : toward < -t ? "getting_worse" : "no_change";
  return { concern, direction, status, delta, toward, threshold: t, noise: baseline.noise, ratio: t > 0 ? Math.abs(toward) / t : 0 };
}

const RANK: Record<TargetStatus, number> = { getting_worse: 0, missing: 1, no_change: 2, holding_up: 3 };

export function judgeClaims(
  claims: Claim[],
  baselines: Partial<Record<Concern, Baseline>>,
  latest: Measurement[],
  cfg: MeasureConfig,
): ClaimResult[] {
  const latestBy = new Map(latest.map((m) => [m.concern, m.raw]));
  return claims.map((c) => {
    if (!c.measurable || c.targets.length === 0) {
      return { claimId: c.id, text: c.text, main: false, measurable: false, status: "not_measured", targets: [] };
    }
    const targets = c.targets.map((t) => judgeTarget(t.concern, t.direction, baselines[t.concern], latestBy.get(t.concern), cfg));
    const status = targets.reduce<TargetStatus>((worst, t) => (RANK[t.status] < RANK[worst] ? t.status : worst), "holding_up");
    return { claimId: c.id, text: c.text, main: c.main, measurable: true, status, targets };
  });
}

/**
  FR-024: Keep only when every target of the main claim is holding up and no target of any
  measurable claim is getting worse; otherwise Return. None once the deadline has passed.
*/
export function suggest(results: ClaimResult[], trial: Pick<Trial, "deadline">, today: string): Suggestion {
  if (today > trial.deadline) return "none";
  const main = results.find((r) => r.main && r.measurable);
  if (!main) return "return";
  const mainHolds = main.targets.length > 0 && main.targets.every((t) => t.status === "holding_up");
  const anyWorse = results.some((r) => r.targets.some((t) => t.status === "getting_worse"));
  return mainHolds && !anyWorse ? "keep" : "return";
}

/** The concerns whose latest reading moved away from the claim beyond threshold, for the summary line. */
export const worsened = (results: ClaimResult[]) =>
  [...new Set(results.flatMap((r) => r.targets.filter((t) => t.status === "getting_worse").map((t) => t.concern)))];
