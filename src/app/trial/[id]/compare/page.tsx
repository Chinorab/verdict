import type { Metadata } from "next";
import { CompareView } from "./CompareView";

export const metadata: Metadata = { title: "Compare photos" };

export default async function ComparePage({ params }: PageProps<"/trial/[id]/compare">) {
  const { id } = await params;
  return <CompareView id={id} />;
}
