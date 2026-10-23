import type { Metadata } from "next";
import { CaptureView } from "./CaptureView";

export const metadata: Metadata = { title: "Take a photo", robots: { index: false } };

/* Guided capture (T046): day 0 takes two photos, a check-in takes one (T052). */
export default async function CapturePage({ params, searchParams }: PageProps<"/trial/[id]/capture">) {
  const { id } = await params;
  const { day } = await searchParams;
  const n = typeof day === "string" && /^\d{1,3}$/.test(day) ? Number(day) : null;
  return <CaptureView id={id} day={n} />;
}
