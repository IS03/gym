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
  | { status: 'conflict'; code: 'IDEMPOTENCY_KEY_REUSED'; message: string; meta: MobileApiResultMeta }
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
