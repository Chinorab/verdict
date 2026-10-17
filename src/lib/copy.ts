/*
  Every error the user can meet, in plain English (constitution VII: no dashes, no jargon).
  YouCam codes come from the AI Skin Analysis "File Specs and Errors" section.
*/

export type ErrorCopy = { title: string; action: string };

const CAPTURE: Record<string, ErrorCopy> = {
  error_src_face_too_small: {
    title: "Your face is too small in the photo.",
    action: "Move the phone closer until your face fills most of the frame, then try again.",
  },
  error_src_face_out_of_bound: {
    title: "Part of your face is outside the frame.",
    action: "Center your face in the outline and keep your whole face in view.",
  },
  error_lighting_dark: {
    title: "The light is too dark to measure your skin.",
    action: "Face a window or a lamp so the light falls evenly on your face, then try again.",
  },
  error_below_min_image_size: {
    title: "The photo is too small to measure.",
    action: "Use the camera in the app instead of a saved photo, or pick a larger photo.",
  },
  error_exceed_max_image_size: {
    title: "The photo is too large.",
    action: "Take the photo with the camera in the app, which sizes it for you.",
  },
  error_mode_mismatch: {
    title: "This photo cannot be compared with your day 0 photos.",
    action: "Use the same phone and the camera in the app, so every photo is measured the same way.",
  },
};

const GENERIC: Record<string, ErrorCopy> = {
  cap_device: {
    title: "You have used today's analyses on this device.",
    action: "Your photos and results are saved. Analyses resume at {time}.",
  },
  cap_global: {
    title: "Analyses are paused for now to keep the service running for everyone.",
    action: "Your photos and results are saved. Try again after {time}, or open the demo trial meanwhile.",
  },
  cap_labels: {
    title: "You have read the maximum number of labels for today.",
    action: "You can type the claims instead, or try again after {time}.",
  },
  no_claims: {
    title: "No claims could be read on this label.",
    action: "Photograph the side where the promises are printed, or type them.",
  },
  network: {
    title: "The connection dropped.",
    action: "Your photo is saved on this phone. Try again when you are back online.",
  },
  timeout: {
    title: "The analysis is taking longer than usual.",
    action: "Your photo is saved. Check again in a minute; you will not be charged twice.",
  },
  storage_unavailable: {
    title: "This browser is not keeping data for Verdict.",
    action: "Private browsing or blocked site data stops trials from being saved. Use a normal window to keep your trial.",
  },
  camera_denied: {
    title: "Verdict cannot use the camera.",
    action: "Allow camera access for this site in your browser settings, or upload a photo instead.",
  },
  upload_blocked: {
    title: "The photo could not be sent for analysis.",
    action: "Check your connection and try again. Your photo is saved on this phone.",
  },
  upload_failed: {
    title: "The photo upload did not finish.",
    action: "Try again. Your photo is saved on this phone.",
  },
  upload_missing: {
    title: "The photo upload did not finish.",
    action: "Try again. Your photo is saved on this phone.",
  },
  rate_limited: {
    title: "The analysis service is busy.",
    action: "Wait a minute and try again. Your photo is saved on this phone.",
  },
  unavailable: {
    title: "Analyses are not available right now.",
    action: "Your photos are saved. Try again later, or open the demo trial meanwhile.",
  },
  unknown: {
    title: "Something went wrong with this analysis.",
    action: "Your photo is saved. Try again; failed analyses do not count against your day.",
  },
};

export function errorCopy(code: string, resumesAt?: string | Date): ErrorCopy {
  const base = CAPTURE[code] ?? GENERIC[code] ?? GENERIC.unknown;
  if (!resumesAt) return base;
  const when = new Date(resumesAt).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return { ...base, action: base.action.replace("{time}", when) };
}
