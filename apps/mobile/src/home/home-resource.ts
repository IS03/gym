import type { ApiResourceState } from '@/api/resource';

/**
 * What a Home block needs from one read: the last confirmed data (current or kept from a
 * failed refresh) and whether it is loading for the first time or unavailable. Each block
 * renders its own skeleton / unavailable state from this, never from another block's read.
 */
export type HomeResource<T> = {
  data: T | undefined;
  status: 'loading' | 'ready' | 'unavailable';
  confirmedAt: number | null;
};

export function homeResource<T>(state: ApiResourceState<T>): HomeResource<T> {
  if (state.status === 'loading') return { confirmedAt: null, data: undefined, status: 'loading' };
  if (state.status === 'ready') return { confirmedAt: state.current.confirmedAt, data: state.current.data, status: 'ready' };
  return { confirmedAt: state.previous?.confirmedAt ?? null, data: state.previous?.data, status: 'unavailable' };
}
