import { notFound, redirect } from "next/navigation";
import { getWorkoutSessionDetail } from "@/lib/phase2/training-robust";
import { SessionCorrectionForm } from "./session-correction-form";

export const dynamic = "force-dynamic";

export default async function CorrectSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getWorkoutSessionDetail(id);
  if (!detail) notFound();
  if (detail.session.status !== "completed") redirect(`/train/session/${id}`);
  return <div className="lg:mx-auto lg:max-w-[760px]"><SessionCorrectionForm detail={detail} /></div>;
}
