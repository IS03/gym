import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { startConfirmLabel, type StartConfirmProps } from './start-confirm.types';

/** Android and other platforms: a plain alert with the same two choices. */
export function StartConfirm({ onCancel, onConfirm, open, routineName }: StartConfirmProps) {
  const handlers = useRef({ onCancel, onConfirm });
  useEffect(() => { handlers.current = { onCancel, onConfirm }; });
  useEffect(() => {
    if (!open) return;
    Alert.alert(`¿${startConfirmLabel(routineName)}?`, undefined, [
      { onPress: () => handlers.current.onCancel(), style: 'cancel', text: 'Cancelar' },
      { onPress: () => handlers.current.onConfirm(), text: 'Empezar' },
    ], { cancelable: true, onDismiss: () => handlers.current.onCancel() });
  }, [open, routineName]);
  return null;
}
