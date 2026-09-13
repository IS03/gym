import { notFound, redirect } from "next/navigation";
import { getWorkoutSessionDetail } from "@/lib/phase2/training-robust";
import { SessionCorrectionForm } from "./session-correction-form";

export const dynamic = "force-dynamic";

export default async function CorrectSessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const search = (await searchParams) ?? {};
  const requestedReturn = typeof search.return === "string" ? search.return : null;
  const returnHref = requestedReturn?.startsWith("/history?") ? requestedReturn : null;
  const detail = await getWorkoutSessionDetail(id);
  if (!detail) notFound();
  if (detail.session.status !== "completed") redirect(`/train/session/${id}`);
  return <div className="lg:mx-auto lg:max-w-[760px]"><SessionCorrectionForm detail={detail} returnHref={returnHref} /></div>;
}
