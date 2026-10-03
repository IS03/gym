export type MobileApiMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

export type MobileApiUnavailableReason =
  | 'aborted'
  | 'auth'
  | 'invalid_response'
  | 'network'
  | 'server'
  | 'timeout';

export type MobileApiOutcome =
  | 'auth_required'
  | 'conflict'
  | 'not_found'
  | 'ok'
  | 'unauthorized'
  | 'unavailable'
  | 'validation';

export type MobileApiResultMeta = {
  durationMs: number;
  httpStatus: number | null;
  outcome: MobileApiOutcome;
};

export type MobileApiReadResult<T> =
  | { status: 'ok'; data: T; meta: MobileApiResultMeta }
  | { status: 'auth_required'; meta: MobileApiResultMeta }
  | { status: 'unauthorized'; meta: MobileApiResultMeta }
  | {
      status: 'unavailable';
      reason: MobileApiUnavailableReason;
      meta: MobileApiResultMeta;
    };

export type MobileApiMutationResult<T> =
  | { status: 'ok'; data: T; meta: MobileApiResultMeta }
  | {
      status: 'conflict';
      code:
        | 'IDEMPOTENCY_KEY_REUSED'
        | 'METRICS_CHANGED'
        | 'METRIC_UNAVAILABLE'
        | 'CONTEXT_CHANGED'
        | 'CONTEXT_UNAVAILABLE'
        | 'POSSIBLE_DUPLICATE'
        | 'MEAL_CHANGED'
        | 'MEAL_UNAVAILABLE'
        | 'DAY_HAS_HISTORICAL_SUMMARY'
        | 'ACTIVE_SESSION_EXISTS'
        | 'ROUTINE_CHANGED'
        | 'ROUTINE_TEMPLATE_CHANGED'
        | 'SESSION_EXERCISE_CHANGED'
        | 'SESSION_CHANGED'
        | 'SESSION_CLOSED'
        | 'SESSION_EXERCISE_REMOVED'
        | 'SESSION_EXERCISE_ALREADY_EXISTS'
        | 'NO_COMPLETED_SETS'
        | 'SESSION_NOT_COMPLETED'
        | 'SESSION_DISCARDED';
      message: string;
      data?: T;
      meta: MobileApiResultMeta;
    }
  | { status: 'validation'; message: string; meta: MobileApiResultMeta }
  | { status: 'not_found'; message: string; meta: MobileApiResultMeta }
  | { status: 'auth_required'; meta: MobileApiResultMeta }
  | { status: 'unauthorized'; meta: MobileApiResultMeta }
  | {
      status: 'unavailable';
      reason: MobileApiUnavailableReason;
      meta: MobileApiResultMeta;
    };

export type MobileApiRequestResult<T> = MobileApiMutationResult<T>;
