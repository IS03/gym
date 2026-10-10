/**
 * Confirmation before starting a routine straight away (▶ on a routine, "Iniciar" in the
 * editor). Rendered inside the button's container so the native dialog points at it.
 */
export type StartConfirmProps = {
  open: boolean;
  routineName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export const startConfirmLabel = (routineName: string) => `Empezar ${routineName}`;
