// ============================================================================
// عافيتك Service Request Store - Zustand Store for Service Request Management
// ============================================================================

import { create } from 'zustand';
import type { ServiceRequest, ServiceRequestStatus } from '@/types';

// ---- Types ----

interface CurrentRequest {
  serviceId: string | null;
  scheduledAt: Date | null;
  address: string;
  location: { lat: number; lng: number } | null;
  paymentMethod: string;
  couponCode: string;
  notes: string;
}

interface ServiceRequestState {
  // Current request being created
  currentRequest: CurrentRequest;

  // Active requests
  activeRequests: ServiceRequest[];

  // Loading states
  isLoading: boolean;
  isSubmitting: boolean;

  // Error state
  error: string | null;

  // Actions
  setCurrentRequest: (data: Partial<CurrentRequest>) => void;
  resetCurrentRequest: () => void;
  addActiveRequest: (request: ServiceRequest) => void;
  updateRequestStatus: (id: string, status: ServiceRequestStatus) => void;
  removeActiveRequest: (id: string) => void;
  setActiveRequests: (requests: ServiceRequest[]) => void;
  setLoading: (loading: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

// ---- Initial State ----

const initialCurrentRequest: CurrentRequest = {
  serviceId: null,
  scheduledAt: null,
  address: '',
  location: null,
  paymentMethod: 'cash',
  couponCode: '',
  notes: '',
};

// ---- Service Request Store ----

export const useServiceRequestStore = create<ServiceRequestState>()(
  (set) => ({
    // Initial State
    currentRequest: { ...initialCurrentRequest },
    activeRequests: [],
    isLoading: false,
    isSubmitting: false,
    error: null,

    // ---- Actions ----

    setCurrentRequest: (data: Partial<CurrentRequest>) => {
      set((state) => ({
        currentRequest: { ...state.currentRequest, ...data },
      }));
    },

    resetCurrentRequest: () => {
      set({ currentRequest: { ...initialCurrentRequest } });
    },

    addActiveRequest: (request: ServiceRequest) => {
      set((state) => ({
        activeRequests: [request, ...state.activeRequests],
      }));
    },

    updateRequestStatus: (id: string, status: ServiceRequestStatus) => {
      set((state) => ({
        activeRequests: state.activeRequests.map((req) =>
          req.id === id ? { ...req, status, updatedAt: new Date() } : req
        ),
      }));
    },

    removeActiveRequest: (id: string) => {
      set((state) => ({
        activeRequests: state.activeRequests.filter((req) => req.id !== id),
      }));
    },

    setActiveRequests: (requests: ServiceRequest[]) => {
      set({ activeRequests: requests });
    },

    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },

    setSubmitting: (submitting: boolean) => {
      set({ isSubmitting: submitting });
    },

    setError: (error: string | null) => {
      set({ error });
    },

    clearError: () => {
      set({ error: null });
    },
  })
);
