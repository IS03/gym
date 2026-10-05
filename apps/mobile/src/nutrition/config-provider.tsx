import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useMobileApi } from '@/api';
import { useMobileAuth } from '@/auth';
import { ConfigurationEditor } from './config-editor';
import { useConfigurationController } from './use-config-controller';

type SharedConfiguration = ReturnType<typeof useConfigurationController>;
type ContextValue = { current: SharedConfiguration; subscribeConfirmed: (listener: () => void) => () => void };
const ConfigurationContext = createContext<ContextValue | null>(null);

/**
 * The single ConfigurationController of the signed-in user, shared by Nutrition and
 * Settings: one instance, one durable intent (`ownlevel.nutrition.config.v1.<userId>`),
 * one editor. A user switch disposes the previous instance; its intent stays in its
 * own namespace and is never shown to another user.
 */
export function NutritionConfigurationProvider({ children }: PropsWithChildren) {
  const { client } = useMobileApi();
  const { session } = useMobileAuth();
  const userId = session?.user.id ?? null;
  const listeners = useRef(new Set<() => void>());
  const invalidate = useCallback(() => { listeners.current.forEach(listener => listener()); }, []);
  const current = useConfigurationController(userId ? client : null, userId ?? 'anonymous', invalidate);
  const subscribeConfirmed = useCallback((listener: () => void) => {
    listeners.current.add(listener);
    return () => { listeners.current.delete(listener); };
  }, []);
  const value = useMemo(() => ({ current, subscribeConfirmed }), [current, subscribeConfirmed]);
  return <ConfigurationContext.Provider value={value}>
    {children}
    {current ? <ConfigurationEditor controller={current.controller} state={current.state} /> : null}
  </ConfigurationContext.Provider>;
}

/** The shared controller (null while signed out or initializing). `onConfirmed` runs after every confirmed save. */
export function useNutritionConfiguration(onConfirmed?: () => void): SharedConfiguration {
  const value = useContext(ConfigurationContext);
  if (!value) throw new Error('useNutritionConfiguration must be used inside NutritionConfigurationProvider');
  const { subscribeConfirmed } = value;
  useEffect(() => (onConfirmed ? subscribeConfirmed(onConfirmed) : undefined), [onConfirmed, subscribeConfirmed]);
  return value.current;
}
