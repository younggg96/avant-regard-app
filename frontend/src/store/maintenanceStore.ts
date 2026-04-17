import { create } from "zustand";

interface MaintenanceState {
  isDown: boolean;
  setDown: (value: boolean) => void;
}

export const useMaintenanceStore = create<MaintenanceState>((set) => ({
  isDown: false,
  setDown: (value) => set({ isDown: value }),
}));

let recoveryTimer: ReturnType<typeof setTimeout> | null = null;

const originalFetch = global.fetch;

global.fetch = async function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await originalFetch(input, init);

  if (response.status === 502) {
    useMaintenanceStore.getState().setDown(true);

    if (recoveryTimer) clearTimeout(recoveryTimer);
    recoveryTimer = setTimeout(() => {
      useMaintenanceStore.getState().setDown(false);
    }, 30_000);
  } else if (useMaintenanceStore.getState().isDown) {
    useMaintenanceStore.getState().setDown(false);
  }

  return response;
};
