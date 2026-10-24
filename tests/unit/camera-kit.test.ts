import { describe, expect, it, vi } from "vitest";
import { cameraFailure, imageFromCapture, openKit, qualityView, type Ymk } from "@/lib/camera-kit";

describe("qualityView", () => {
  it("waits before the first quality event", () => {
    const v = qualityView(null);
    expect([v.light.state, v.framing.state, v.angle.state]).toEqual(["wait", "wait", "wait"]);
    expect(v.canShoot).toBe(false);
  });

  it("asks for a face when none is found", () => {
    const v = qualityView({ hasFace: false });
    expect(v.framing).toEqual({ state: "fix", label: "Show your face" });
    expect(v.canShoot).toBe(false);
  });

  it("is all good with good light, position and angle", () => {
    const v = qualityView({ hasFace: true, position: "good", frontal: "good", lighting: "good" });
    expect([v.light.state, v.framing.state, v.angle.state]).toEqual(["ok", "ok", "ok"]);
    expect(v.canShoot).toBe(true);
  });

  it("allows a manual photo when only the light is ok (research R2, measured on a phone)", () => {
    const v = qualityView({ hasFace: true, position: "good", frontal: "good", lighting: "ok" });
    expect(v.light).toEqual({ state: "fix", label: "Add a little light" });
    expect(v.canShoot).toBe(true);
  });

  it("refuses a manual photo in poor light, off center, too far or turned", () => {
    const base = { hasFace: true, position: "good", frontal: "good", lighting: "good" };
    expect(qualityView({ ...base, lighting: "notgood" }).canShoot).toBe(false);
    expect(qualityView({ ...base, position: "toosmall" }).framing.label).toBe("Move closer");
    expect(qualityView({ ...base, position: "outofboundary" }).canShoot).toBe(false);
    expect(qualityView({ ...base, frontal: "notgood" }).angle.label).toBe("Look straight ahead");
    expect(qualityView({ ...base, frontal: "notgood" }).canShoot).toBe(false);
  });
});

describe("imageFromCapture", () => {
  it("reads a blob image with its size", async () => {
    const blob = new Blob(["x"], { type: "image/jpeg" });
    const img = await imageFromCapture({ images: [{ image: blob, width: 1080, height: 1788 }] });
    expect(img).toEqual({ blob, width: 1080, height: 1788 });
  });

  it("converts a base64 data URL", async () => {
    const img = await imageFromCapture({ images: [{ image: "data:image/jpeg;base64,eA==", width: 10, height: 20 }] });
    expect(img?.blob.size).toBe(1);
    expect(img?.width).toBe(10);
  });

  it("rejects empty or sizeless payloads", async () => {
    expect(await imageFromCapture({ images: [] })).toBeNull();
    expect(await imageFromCapture({ images: [{ image: new Blob(["x"]) }] })).toBeNull();
    expect(await imageFromCapture(null)).toBeNull();
  });
});

describe("cameraFailure", () => {
  it("maps the documented cameraFailed codes", () => {
    expect(cameraFailure("error_permission_denied")).toBe("camera_denied");
    expect(cameraFailure({ error: "error_resolution_unsupported" })).toBe("camera_resolution");
    expect(cameraFailure("error_access_failed")).toBe("camera_failed");
  });
});

function fakeYmk() {
  const listeners = new Map<number, { event: string; cb: (p: unknown) => void }>();
  let next = 1;
  const ymk = {
    init: vi.fn(),
    openCameraKit: vi.fn(),
    close: vi.fn(),
    capture: vi.fn(),
    addEventListener: vi.fn((event: string, cb: (p: unknown) => void) => {
      listeners.set(next, { event, cb });
      return next++;
    }),
    removeEventListener: vi.fn((id: unknown) => listeners.delete(id as number)),
  } satisfies Ymk;
  const emit = (event: string, payload?: unknown) => {
    for (const l of listeners.values()) if (l.event === event) l.cb(payload);
  };
  return { ymk, emit, listeners };
}

describe("openKit", () => {
  it("opens skincare, strict, 1080p, blob and forwards events", async () => {
    const { ymk, emit } = fakeYmk();
    const onQuality = vi.fn();
    const onCaptured = vi.fn();
    const onFailed = vi.fn();
    openKit(ymk, { onQuality, onCaptured, onFailed });
    expect(ymk.init).toHaveBeenCalledWith(
      expect.objectContaining({ faceDetectionMode: "skincare", qualityLevel: "strict", videoQuality: "1080p", imageFormat: "blob" }),
    );
    expect(ymk.openCameraKit).toHaveBeenCalledOnce();

    emit("faceQualityChanged", { hasFace: true, lighting: "ok" });
    expect(onQuality).toHaveBeenCalledWith({ hasFace: true, lighting: "ok" });

    emit("faceDetectionCaptured", { images: [{ image: new Blob(["x"]), width: 1080, height: 1788 }] });
    await vi.waitFor(() => expect(onCaptured).toHaveBeenCalledOnce());

    emit("cameraFailed", "error_permission_denied");
    expect(onFailed).toHaveBeenCalledWith("camera_denied");
  });

  it("lets a camera below 1080p through only when asked (laptop webcams, measured in SD)", () => {
    const strict = fakeYmk();
    openKit(strict.ymk, { onQuality: vi.fn(), onCaptured: vi.fn(), onFailed: vi.fn() });
    expect(strict.ymk.init.mock.calls[0][0]).not.toHaveProperty("disableCameraResolutionCheck");
    const any = fakeYmk();
    openKit(any.ymk, { onQuality: vi.fn(), onCaptured: vi.fn(), onFailed: vi.fn() }, { level: "moderate", anyResolution: true });
    expect(any.ymk.init).toHaveBeenCalledWith(expect.objectContaining({ qualityLevel: "moderate", disableCameraResolutionCheck: true }));
  });

  it("captures on demand and removes every listener on close", () => {
    const { ymk, listeners } = fakeYmk();
    const kit = openKit(ymk, { onQuality: vi.fn(), onCaptured: vi.fn(), onFailed: vi.fn() }, { level: "moderate" });
    expect(ymk.init).toHaveBeenCalledWith(expect.objectContaining({ qualityLevel: "moderate" }));
    expect(kit.capture()).toBe(true);
    expect(ymk.capture).toHaveBeenCalledOnce();
    kit.close();
    expect(listeners.size).toBe(0);
    expect(kit.capture()).toBe(false);
  });
});
