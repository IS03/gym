export type WorkoutFinishVerification =
  | "completed"
  | "in_progress"
  | "unknown";

export type WorkoutFinishOutcome =
  | { status: "confirmed_success"; recovered: boolean }
  | { status: "confirmed_failure" }
  | { status: "unknown_outcome" };

export function resolveWorkoutFinishOutcome(
  actionConfirmed: boolean,
  verification: WorkoutFinishVerification = "unknown",
): WorkoutFinishOutcome {
  if (actionConfirmed) return { status: "confirmed_success", recovered: false };
  if (verification === "completed") {
    return { status: "confirmed_success", recovered: true };
  }
  if (verification === "in_progress") return { status: "confirmed_failure" };
  return { status: "unknown_outcome" };
}
