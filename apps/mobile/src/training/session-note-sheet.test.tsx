import { act, fireEvent, render, within } from '@testing-library/react-native';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Alert, KeyboardAvoidingView, Modal, Platform, StyleSheet } from 'react-native';
import { ScreenStackItem } from 'react-native-screens';
import { OwnlevelThemeProvider } from '@/design-system';
import { SessionNoteSheet } from './session-note-sheet';
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
function sheet(onSave = jest.fn<(note: string) => Promise<boolean>>().mockResolvedValue(true), editable = true) {
  const close = jest.fn();
  const view = render(<OwnlevelThemeProvider initialMode="light"><SessionNoteSheet name="PRESS" value="" editable={editable} onSave={onSave} onClose={close} /></OwnlevelThemeProvider>);
  fireEvent(view.UNSAFE_getByType(Modal), 'show');
  return { view, onSave, close };
}
describe('compact exercise note sheet', () => {
  afterEach(() => { jest.restoreAllMocks(); });
  it('uses native iOS 75% detent/dimming with X and Guardar above the keyboard body', () => {
    const { view } = sheet();
    const native = view.UNSAFE_getAllByType(ScreenStackItem).find(node => node.props.screenId === 'exercise-note')!;
    expect(native.props.stackPresentation).toBe('formSheet'); expect(native.props.sheetAllowedDetents).toEqual([0.75]);
    expect(native.props.sheetLargestUndimmedDetentIndex).toBe('none');
    const header = view.getByTestId('note-sheet-header');
    expect(within(header).getByLabelText('Cerrar Nota del ejercicio')).toBeVisible();
    expect(within(header).getByLabelText('Guardar nota')).toBeDisabled();
    expect(within(view.getByTestId('note-keyboard-body')).queryByLabelText('Guardar nota')).toBeNull();
    expect(view.getByLabelText('Nota de PRESS').props.placeholder).toBe('Algo para recordar…');
    expect(view.queryByRole('button', { name: 'Listo' })).toBeNull();
  });
  it('edits locally then saves once from the header and closes only after confirmation', async () => {
    let resolve!: (value: boolean) => void;
    const save = jest.fn<(note: string) => Promise<boolean>>().mockReturnValue(new Promise(done => { resolve = done; }));
    const { view, close } = sheet(save);
    fireEvent.changeText(view.getByLabelText('Nota de PRESS'), 'Recordar el agarre'); expect(save).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText('Guardar nota')); expect(save).toHaveBeenCalledTimes(1); expect(save).toHaveBeenCalledWith('Recordar el agarre');
    expect(close).not.toHaveBeenCalled(); expect(view.getByLabelText('Guardar nota')).toBeDisabled();
    await act(async () => resolve(true)); expect(close).toHaveBeenCalledTimes(1);
  });
  it('asks before closing unsaved edits, but closes untouched notes without a confirmation', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const untouched = sheet(); fireEvent.press(untouched.view.getByLabelText('Cerrar Nota del ejercicio'));
    expect(untouched.close).toHaveBeenCalledTimes(1); expect(alert).not.toHaveBeenCalled(); untouched.view.unmount();
    const edited = sheet(); fireEvent.changeText(edited.view.getByLabelText('Nota de PRESS'), 'Pendiente');
    fireEvent.press(edited.view.getByLabelText('Cerrar Nota del ejercicio')); expect(edited.close).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('¿Cerrar sin guardar?', expect.any(String), expect.any(Array));
    const native = edited.view.UNSAFE_getAllByType(ScreenStackItem).find(node => node.props.screenId === 'exercise-note')!;
    expect(native.props.preventNativeDismiss).toBe(true);
    act(() => alert.mock.calls.at(-1)?.[2]?.find(button => button.text === 'Descartar')?.onPress?.()); expect(edited.close).toHaveBeenCalledTimes(1);
  });
  it('retains failed/unconfirmed note changes and keeps save/close available for recovery', async () => {
    const { view, close } = sheet(jest.fn<(note: string) => Promise<boolean>>().mockResolvedValue(false));
    fireEvent.changeText(view.getByLabelText('Nota de PRESS'), 'Conservar');
    await act(async () => fireEvent.press(view.getByLabelText('Guardar nota')));
    expect(view.getByRole('alert')).toBeVisible(); expect(view.getByLabelText('Nota de PRESS').props.value).toBe('Conservar');
    expect(close).not.toHaveBeenCalled(); expect(view.getByLabelText('Guardar nota')).toBeEnabled();
  });
  it('provides a compact dimmed non-iOS fallback using the same keyboard-safe header', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { view } = sheet(); expect(view.UNSAFE_getByType(Modal).props.transparent).toBe(true);
    expect(view.getByLabelText('Guardar nota')).toBeVisible(); expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('height');
  });
  it('starts with a 144px textarea rather than flex-filling the sheet and caps growth for long notes', () => {
    const { view } = sheet();
    const initialStyle = StyleSheet.flatten(view.getByLabelText('Nota de PRESS').props.style);
    expect(initialStyle.height).toBe(144); expect(initialStyle.flex).toBeUndefined();
    fireEvent(view.getByLabelText('Nota de PRESS'), 'contentSizeChange', { nativeEvent: { contentSize: { height: 170, width: 300 } } });
    expect(StyleSheet.flatten(view.getByLabelText('Nota de PRESS').props.style).height).toBe(170);
    fireEvent(view.getByLabelText('Nota de PRESS'), 'contentSizeChange', { nativeEvent: { contentSize: { height: 600, width: 300 } } });
    expect(StyleSheet.flatten(view.getByLabelText('Nota de PRESS').props.style).height).toBe(220);
    expect(within(view.getByTestId('note-sheet-header')).getByLabelText('Guardar nota')).toBeVisible();
  });
});
