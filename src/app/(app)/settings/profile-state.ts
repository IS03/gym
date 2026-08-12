export type ProfileSaveState = {
  status: "idle" | "success" | "partial" | "error";
  message: string | null;
};

export const initialProfileSaveState: ProfileSaveState = {
  status: "idle",
  message: null,
};
