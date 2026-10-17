import type { Metadata } from "next";
import { TimelineView } from "./TimelineView";

export const metadata: Metadata = { title: "Trial" };

export default async function TrialPage({ params }: PageProps<"/trial/[id]">) {
  const { id } = await params;
  return <TimelineView id={id} />;
}
