import { create } from "zustand";
import type { HealthResponse } from "../types/health";

type HealthState = {
  data: HealthResponse | null;
  loading: boolean;
  error: string | null;
  lastChecked: string | null;
  setLoading: (v: boolean) => void;
  setData: (d: HealthResponse) => void;
  setError: (e: string | null) => void;
};

export const useHealthStore = create<HealthState>((set) => ({
  data: null,
  loading: false,
  error: null,
  lastChecked: null,
  setLoading: (loading) => set({ loading }),
  setData: (data) => set({ data, error: null, lastChecked: new Date().toISOString() }),
  setError: (error) => set({ error, lastChecked: new Date().toISOString() }),
}));
