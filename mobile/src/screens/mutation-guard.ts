export type PendingMutationRef = { current: boolean };

export async function runSingleMutation(
  pending: PendingMutationRef,
  mutation: () => Promise<void>,
): Promise<boolean> {
  if (pending.current) return false;
  pending.current = true;
  try {
    await mutation();
    return true;
  } finally {
    pending.current = false;
  }
}
