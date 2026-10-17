import type { Metadata } from "next";
import { NewTrial } from "./NewTrial";

export const metadata: Metadata = { title: "New trial" };

export default async function NewTrialPage({ searchParams }: PageProps<"/trial/new">) {
  const { quick } = await searchParams;
  return <NewTrial quick={quick === "1"} />;
}
