// ============================================================================
// عافيتك Nurse Store - Zustand Store for Nurse State Management
// ============================================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ServiceAssignment } from '@/types';

// ---- Types ----

interface NurseEarnings {
  total: number;
  available: number;
  thisWeek: number;
  thisMonth: number;
}

interface NurseState {
  // Online/Availability
  isOnline: boolean;
  isAvailable: boolean;

  // Location
  currentLocation: { lat: number; lng: number } | null;

  // Assignments
  assignments: ServiceAssignment[];

  // Earnings
  earnings: NurseEarnings;

  // Loading states
  isLoadingAssignments: boolean;
  isLoadingEarnings: boolean;

  // Error state
  error: string | null;

  // Actions
  setOnline: (isOnline: boolean) => void;
  setAvailable: (isAvailable: boolean) => void;
  updateLocation: (lat: number, lng: number) => void;
  clearLocation: () => void;
  setAssignments: (assignments: ServiceAssignment[]) => void;
  addAssignment: (assignment: ServiceAssignment) => void;
  updateAssignmentStatus: (assignmentId: string, status: string) => void;
  removeAssignment: (assignmentId: string) => void;
  setEarnings: (earnings: NurseEarnings) => void;
  updateEarnings: (earnings: Partial<NurseEarnings>) => void;
  setLoadingAssignments: (loading: boolean) => void;
  setLoadingEarnings: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

// ---- Safe Storage ----

function safeStorage() {
  if (typeof window !== 'undefined') {
    return localStorage;
  }
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

// ---- Nurse Store ----

export const useNurseStore = create<NurseState>()(
  persist(
    (set) => ({
      // Initial State
      isOnline: false,
      isAvailable: false,
      currentLocation: null,
      assignments: [],
      earnings: {
        total: 0,
        available: 0,
        thisWeek: 0,
        thisMonth: 0,
      },
      isLoadingAssignments: false,
      isLoadingEarnings: false,
      error: null,

      // ---- Online/Availability Actions ----

      setOnline: (isOnline: boolean) => {
        set({ isOnline });
      },

      setAvailable: (isAvailable: boolean) => {
        set({ isAvailable });
      },

      // ---- Location Actions ----

      updateLocation: (lat: number, lng: number) => {
        set({ currentLocation: { lat, lng } });
      },

      clearLocation: () => {
        set({ currentLocation: null });
      },

      // ---- Assignment Actions ----

      setAssignments: (assignments: ServiceAssignment[]) => {
        set({ assignments });
      },

      addAssignment: (assignment: ServiceAssignment) => {
        set((state) => ({
          assignments: [assignment, ...state.assignments],
        }));
      },

      updateAssignmentStatus: (assignmentId: string, status: string) => {
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === assignmentId
              ? { ...a, status, updatedAt: new Date() }
              : a
          ),
        }));
      },

      removeAssignment: (assignmentId: string) => {
        set((state) => ({
          assignments: state.assignments.filter((a) => a.id !== assignmentId),
        }));
      },

      // ---- Earnings Actions ----

      setEarnings: (earnings: NurseEarnings) => {
        set({ earnings });
      },

      updateEarnings: (earnings: Partial<NurseEarnings>) => {
        set((state) => ({
          earnings: { ...state.earnings, ...earnings },
        }));
      },

      // ---- Loading Actions ----

      setLoadingAssignments: (loading: boolean) => {
        set({ isLoadingAssignments: loading });
      },

      setLoadingEarnings: (loading: boolean) => {
        set({ isLoadingEarnings: loading });
      },

      // ---- Error Actions ----

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'aafiatak-nurse-storage',
      // CRITICAL: skipHydration prevents Zustand from reading localStorage
      // synchronously during store creation, avoiding React Error #300.
      skipHydration: true,
      storage: createJSONStorage(() => safeStorage()),
      partialize: (state) => ({
        isAvailable: state.isAvailable,
        currentLocation: state.currentLocation,
      }),
    }
  )
);
