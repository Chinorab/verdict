import type { Metadata } from "next";
import { VerdictView } from "./VerdictView";

export const metadata: Metadata = { title: "Your result" };

export default async function VerdictPage({ params }: PageProps<"/trial/[id]/verdict">) {
  const { id } = await params;
  return <VerdictView id={id} />;
}
