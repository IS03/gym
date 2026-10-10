import { StyleSheet } from 'react-native';
import { Button, ConfirmationDialog, Host, Rectangle } from '@expo/ui/swift-ui';
import { foregroundStyle, frame } from '@expo/ui/swift-ui/modifiers';

import { useOwnlevelTheme } from '@/design-system';

import { useHoldStartConfirmLock } from './start-confirm-lock';
import { startConfirmLabel, type StartConfirmProps } from './start-confirm.types';

/**
 * iOS: SwiftUI's confirmation dialog (on iOS 26 a small popover anchored to the button).
 * The host covers the button without taking touches; a clear rectangle is the anchor.
 */
export function StartConfirm({ onCancel, onConfirm, open, routineName }: StartConfirmProps) {
  const { isDark } = useOwnlevelTheme();
  useHoldStartConfirmLock(open);
  return (
    <Host colorScheme={isDark ? 'dark' : 'light'} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <ConfirmationDialog isPresented={open} onIsPresentedChange={presented => { if (!presented) onCancel(); }} title={startConfirmLabel(routineName)} titleVisibility="hidden">
        <ConfirmationDialog.Trigger>
          <Rectangle modifiers={[foregroundStyle('clear'), frame({ maxHeight: 10_000, maxWidth: 10_000 })]} />
        </ConfirmationDialog.Trigger>
        <ConfirmationDialog.Actions>
          <Button label={startConfirmLabel(routineName)} onPress={onConfirm} />
          <Button label="Cancelar" onPress={onCancel} role="cancel" />
        </ConfirmationDialog.Actions>
      </ConfirmationDialog>
    </Host>
  );
}
