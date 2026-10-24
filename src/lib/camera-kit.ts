/*
  YouCam JS Camera Kit v2.5 loader and event mapping (T044, research R3).
  The kit needs no key in the browser. It is loaded on the capture screen only, once per page.
  Measured on an iPhone (research R2): a 1080 px wide JPEG; strict quality waits for
  lighting "good" before it captures by itself, so a manual capture through YMK.capture()
  is offered once face, position and angle are good.
*/

export const KIT_SRC = "https://plugins-media.makeupar.com/v2.5-camera-kit/sdk.js";

export type FaceQuality = {
  hasFace?: boolean;
  position?: "good" | "notgood" | "toosmall" | "outofboundary" | string;
  frontal?: "good" | "notgood" | string;
  lighting?: "good" | "ok" | "notgood" | string;
};

type Listener = (payload: unknown) => void;

export type Ymk = {
  init: (args: Record<string, unknown>) => void;
  openCameraKit: () => void;
  close: () => void;
  capture?: () => unknown;
  addEventListener: (event: string, cb: Listener) => unknown;
  removeEventListener: (id: unknown) => void;
};

declare global {
  interface Window {
    YMK?: Ymk;
    YMKAsyncInit?: () => void;
  }
}

/* Indicators of the capture mockup: Light, Framing, Angle. */
export type IndicatorState = "ok" | "fix" | "wait";
export type Indicator = { state: IndicatorState; label: string };
export type QualityView = { light: Indicator; framing: Indicator; angle: Indicator; canShoot: boolean };

const WAIT: Indicator = { state: "wait", label: "Checking" };

export function qualityView(q: FaceQuality | null): QualityView {
  if (!q) return { light: WAIT, framing: WAIT, angle: WAIT, canShoot: false };
  if (!q.hasFace) {
    return { light: WAIT, framing: { state: "fix", label: "Show your face" }, angle: WAIT, canShoot: false };
  }

  const light: Indicator =
    q.lighting === "good"
      ? { state: "ok", label: "Even" }
      : q.lighting === "ok"
        ? { state: "fix", label: "Add a little light" }
        : { state: "fix", label: "Face the light" };

  const framing: Indicator =
    q.position === "good"
      ? { state: "ok", label: "Centered" }
      : q.position === "toosmall"
        ? { state: "fix", label: "Move closer" }
        : { state: "fix", label: "Center your face" };

  const angle: Indicator =
    q.frontal === "good" ? { state: "ok", label: "Straight" } : { state: "fix", label: "Look straight ahead" };

  // "ok" light still measures (research R2); "notgood" light would fail the analysis.
  const canShoot = q.position === "good" && q.frontal === "good" && (q.lighting === "good" || q.lighting === "ok");
  return { light, framing, angle, canShoot };
}

export type CapturedImage = { blob: Blob; width: number; height: number };

/** First image of a faceDetectionCaptured payload, as a Blob (imageFormat "blob", base64 tolerated). */
export async function imageFromCapture(payload: unknown): Promise<CapturedImage | null> {
  const first = (payload as { images?: { image?: unknown; width?: unknown; height?: unknown }[] } | null)?.images?.[0];
  if (!first) return null;
  const width = Number(first.width);
  const height = Number(first.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  let blob: Blob | null = null;
  if (first.image instanceof Blob) blob = first.image;
  else if (typeof first.image === "string" && first.image.startsWith("data:image/")) {
    blob = await (await fetch(first.image)).blob();
  }
  return blob ? { blob, width: Math.round(width), height: Math.round(height) } : null;
}

/** Error code for a cameraFailed payload, matched to src/lib/copy.ts. */
export function cameraFailure(payload: unknown): "camera_denied" | "camera_resolution" | "camera_failed" {
  const text = JSON.stringify(payload ?? "").toLowerCase();
  if (text.includes("permission")) return "camera_denied";
  if (text.includes("resolution")) return "camera_resolution";
  return "camera_failed";
}

let loading: Promise<Ymk> | null = null;

/** Injects the SDK once and resolves when YMK is ready. */
export function loadKit(src = KIT_SRC, timeoutMs = 20000): Promise<Ymk> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YMK) return Promise.resolve(window.YMK);
  if (loading) return loading;
  loading = new Promise<Ymk>((resolve, reject) => {
    const done = () => {
      if (!window.YMK) return;
      window.clearTimeout(timer);
      resolve(window.YMK);
    };
    const timer = window.setTimeout(() => {
      loading = null;
      reject(new Error("kit_timeout"));
    }, timeoutMs);
    window.YMKAsyncInit = done;
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", done);
    script.addEventListener("error", () => {
      window.clearTimeout(timer);
      loading = null;
      script.remove();
      reject(new Error("kit_load_failed"));
    });
    document.body.appendChild(script);
  });
  return loading;
}

export type KitHandlers = {
  onQuality: (q: FaceQuality) => void;
  onCaptured: (image: CapturedImage) => void;
  onFailed: (code: ReturnType<typeof cameraFailure>) => void;
  onOpened?: () => void;
};

export type KitSession = { capture: () => boolean; close: () => void };

/**
  Opens the camera in the #YMK-module mount. Skincare mode, 1080p output, blob images.
  `level` drops to "moderate" when the strict preset is not supported on this device, and
  `anyResolution` lets a camera below 1080p through (laptop webcams), measured in SD.
*/
export function openKit(
  ymk: Ymk,
  handlers: KitHandlers,
  opts: { level?: "strict" | "moderate"; anyResolution?: boolean; width?: number; height?: number } = {},
): KitSession {
  const ids: unknown[] = [];
  let closed = false;
  const on = (event: string, cb: Listener) => ids.push(ymk.addEventListener(event, cb));

  on("faceQualityChanged", (q) => handlers.onQuality((q ?? {}) as FaceQuality));
  on("faceDetectionCaptured", (payload) => {
    void imageFromCapture(payload).then((img) => {
      if (closed) return;
      if (img) handlers.onCaptured(img);
      else handlers.onFailed("camera_failed");
    });
  });
  on("cameraFailed", (p) => handlers.onFailed(cameraFailure(p)));
  on("unsupportedResolution", () => handlers.onFailed("camera_resolution"));
  if (handlers.onOpened) on("cameraOpened", () => handlers.onOpened?.());

  try {
    ymk.close(); // a kit left open by an earlier screen
  } catch {
    // nothing was open
  }
  ymk.init({
    faceDetectionMode: "skincare",
    imageFormat: "blob",
    language: "enu",
    qualityLevel: opts.level ?? "strict",
    videoQuality: "1080p",
    hideFlipCameraButton: false,
    // A webcam below the kit's required resolution can still be used; its photos lock the trial to SD.
    ...(opts.anyResolution ? { disableCameraResolutionCheck: true } : {}),
    ...(opts.width && opts.height ? { width: opts.width, height: opts.height } : {}),
  });
  ymk.openCameraKit();

  return {
    capture: () => {
      if (closed || typeof ymk.capture !== "function") return false;
      try {
        ymk.capture();
        return true;
      } catch {
        return false;
      }
    },
    close: () => {
      if (closed) return;
      closed = true;
      for (const id of ids) {
        try {
          ymk.removeEventListener(id);
        } catch {
          // listener already gone
        }
      }
      try {
        ymk.close();
      } catch {
        // already closed
      }
    },
  };
}
