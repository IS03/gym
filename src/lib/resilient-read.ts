import {
  measurePerformance,
  type PerformanceEvent,
} from "./request-performance";

export type ReadResult<T> =
  | { status: "ok"; data: T }
  | { status: "unavailable" };

type ReadPerformanceInput = Pick<PerformanceEvent, "route" | "operation">
  & Partial<Pick<PerformanceEvent, "layer" | "requestKind" | "vercelId">>;

export async function resilientRead<T>(
  input: ReadPerformanceInput,
  operation: () => PromiseLike<T>,
): Promise<ReadResult<T>> {
  try {
    return {
      status: "ok",
      data: await measurePerformance(input, operation),
    };
  } catch {
    return { status: "unavailable" };
  }
}

export function mapReadResult<T, U>(
  result: ReadResult<T>,
  transform: (data: T) => U,
): ReadResult<U> {
  return result.status === "ok"
    ? { status: "ok", data: transform(result.data) }
    : result;
}
