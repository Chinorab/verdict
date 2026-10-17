import type { Metadata } from "next";
import { ReviewView } from "./ReviewView";

export const metadata: Metadata = { title: "Share my review" };

export default async function ReviewPage({ params }: PageProps<"/trial/[id]/review">) {
  const { id } = await params;
  return <ReviewView id={id} />;
}
