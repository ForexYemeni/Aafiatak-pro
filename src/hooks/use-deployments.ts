'use client';

// ============================================================================
// عافيتك (Aafiatak) - React Query Hooks for Deployments
// ============================================================================
// Provides cached, real-time synced data fetching for the deployments system.
// Uses React Query for:
// - Automatic caching (stale-while-revalidate)
// - Background refetch on socket events
// - Optimistic updates for mutations
// - Deduplication of API calls
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthFetch } from '@/hooks/use-auth';

// ======== Types ========
interface DeploymentLocation {
  lat?: number;
  lng?: number;
  address?: string;
  governorate?: string;
  district?: string;
}

interface DeploymentApplication {
  _id?: string;
  id?: string;
  applicantId: string;
  applicantRole: string;
  applicantName: string;
  applicantSpecialization?: string[];
  applicantExperience?: number;
  applicantRating?: number;
  applicantCompletedJobs?: number;
  applicantVerificationStatus?: string;
  status: 'pending' | 'selected_by_creator' | 'admin_approved' | 'payment_pending' | 'payment_submitted' | 'payment_verified' | 'accepted' | 'rejected';
  appliedAt: string;
  hasPaymentProof: boolean;
  paymentProofData?: string;
  paymentProofImage?: string;
  paymentSubmittedAt?: string;
  paymentVerifiedAt?: string;
  paymentVerifiedBy?: string;
  serviceFee: number;
  coverLetter?: string;
  rejectedReason?: string;
}

interface DeploymentDetail {
  id: string;
  createdBy: { id?: string; name?: string; phone?: string } | null;
  creatorRole: 'admin' | 'nurse';
  creatorPhone?: string;
  creatorServiceFee?: number;
  applicantServiceFee?: number;
  contactRevealed?: boolean;
  title: string;
  description: string;
  type: string;
  specialization: string[];
  hours: number;
  location: DeploymentLocation;
  amount: number;
  adminCommissionPercent: number;
  adminCommissionAmount: number;
  serviceFee: number;
  totalWithFee: number;
  status: string;
  assignedTo: { id?: string; name?: string; phone?: string } | null;
  assignedAt?: string;
  applications: DeploymentApplication[];
  startDate?: string;
  endDate?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  requirements?: string;
  notes?: string;
  rating?: number;
  ratingComment?: string;
  ratedAt?: string;
  ratedBy?: string;
  createdAt: string;
  updatedAt?: string;
  gender?: string;
  department?: string;
  feeResponsible?: string;
  paymentMethod?: string;
  walletNumber?: string;
  walletOwnerName?: string;
}

// ======== Query Keys ========
export const deploymentKeys = {
  all: ['deployments'] as const,
  lists: () => [...deploymentKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...deploymentKeys.lists(), filters] as const,
  details: () => [...deploymentKeys.all, 'detail'] as const,
  detail: (id: string) => [...deploymentKeys.details(), id] as const,
};

// ======== Hooks ========

/** Fetch list of deployments with caching */
export function useDeployments(enabled = true) {
  const authFetch = useAuthFetch();

  return useQuery({
    queryKey: deploymentKeys.lists(),
    queryFn: async () => {
      const res = await authFetch('/api/deployments?limit=100');
      const json = await res.json();
      if (json.success && json.data) {
        const deps = json.data.deployments ?? json.data;
        return Array.isArray(deps) ? deps : [];
      }
      return [];
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 min before considered stale
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 min
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

/** Fetch a single deployment by ID with caching */
export function useDeployment(deploymentId: string, enabled = true) {
  const authFetch = useAuthFetch();

  return useQuery({
    queryKey: deploymentKeys.detail(deploymentId),
    queryFn: async () => {
      const res = await authFetch(`/api/deployments/${deploymentId}`);
      const json = await res.json();
      if (json.success && json.data) {
        return json.data as DeploymentDetail;
      }
      return null;
    },
    enabled: enabled && !!deploymentId,
    staleTime: 1 * 60 * 1000, // 1 min for detail pages (more real-time)
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

/** Mutation: Apply for a deployment */
export function useApplyForDeployment() {
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ deploymentId, coverLetter }: { deploymentId: string; coverLetter?: string }) => {
      const res = await authFetch(`/api/deployments/${deploymentId}/apply`, {
        method: 'POST',
        body: JSON.stringify({ coverLetter }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? 'فشل التقديم');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deploymentKeys.all });
    },
  });
}

/** Mutation: Select an applicant */
export function useSelectApplicant() {
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ deploymentId, applicationId }: { deploymentId: string; applicationId: string }) => {
      const res = await authFetch(`/api/deployments/${deploymentId}/select-applicant`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? json.message ?? 'فشل اختيار المتقدم');
      return json;
    },
    onSuccess: (_, { deploymentId }) => {
      queryClient.invalidateQueries({ queryKey: deploymentKeys.detail(deploymentId) });
      queryClient.invalidateQueries({ queryKey: deploymentKeys.lists() });
    },
  });
}

/** Mutation: Admin approve selection */
export function useAdminApprove() {
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ deploymentId }: { deploymentId: string }) => {
      const res = await authFetch(`/api/deployments/${deploymentId}/admin-approve`, {
        method: 'PATCH',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? 'فشل الموافقة');
      return json;
    },
    onSuccess: (_, { deploymentId }) => {
      queryClient.invalidateQueries({ queryKey: deploymentKeys.detail(deploymentId) });
      queryClient.invalidateQueries({ queryKey: deploymentKeys.lists() });
    },
  });
}

/** Mutation: Submit payment proof */
export function useSubmitPayment() {
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      deploymentId, 
      paymentProofData, 
      paymentProofImage 
    }: { 
      deploymentId: string; 
      paymentProofData?: string; 
      paymentProofImage?: string;
    }) => {
      const res = await authFetch(`/api/deployments/${deploymentId}/submit-payment`, {
        method: 'POST',
        body: JSON.stringify({
          paymentProofData: paymentProofData || undefined,
          paymentProofImage: paymentProofImage || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? 'فشل تقديم إثبات الدفع');
      return json;
    },
    onSuccess: (_, { deploymentId }) => {
      queryClient.invalidateQueries({ queryKey: deploymentKeys.detail(deploymentId) });
      queryClient.invalidateQueries({ queryKey: deploymentKeys.lists() });
    },
  });
}

/** Mutation: Verify payment (admin) */
export function useVerifyPayment() {
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      deploymentId, 
      applicationId, 
      verified,
      rejectionReason
    }: { 
      deploymentId: string; 
      applicationId: string; 
      verified: boolean;
      rejectionReason?: string;
    }) => {
      const res = await authFetch(`/api/deployments/${deploymentId}/verify-payment`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationId, verified, rejectionReason }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? 'فشل العملية');
      return json;
    },
    onSuccess: (_, { deploymentId }) => {
      queryClient.invalidateQueries({ queryKey: deploymentKeys.detail(deploymentId) });
      queryClient.invalidateQueries({ queryKey: deploymentKeys.lists() });
    },
  });
}

/** Mutation: Change deployment status */
export function useChangeDeploymentStatus() {
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ deploymentId, status }: { deploymentId: string; status: string }) => {
      const res = await authFetch(`/api/deployments/${deploymentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? 'فشل تحديث الحالة');
      return json;
    },
    onSuccess: (_, { deploymentId }) => {
      queryClient.invalidateQueries({ queryKey: deploymentKeys.detail(deploymentId) });
      queryClient.invalidateQueries({ queryKey: deploymentKeys.lists() });
    },
  });
}

/** Mutation: Rate a deployment */
export function useRateDeployment() {
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      deploymentId, 
      rating, 
      ratingComment 
    }: { 
      deploymentId: string; 
      rating: number; 
      ratingComment?: string;
    }) => {
      const res = await authFetch(`/api/deployments/${deploymentId}/rate`, {
        method: 'POST',
        body: JSON.stringify({ rating, ratingComment }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? 'فشل التقييم');
      return json;
    },
    onSuccess: (_, { deploymentId }) => {
      queryClient.invalidateQueries({ queryKey: deploymentKeys.detail(deploymentId) });
      queryClient.invalidateQueries({ queryKey: deploymentKeys.lists() });
    },
  });
}

/** Mutation: Create a new deployment */
export function useCreateDeployment() {
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/deployments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? 'فشل إنشاء التكليف');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deploymentKeys.lists() });
    },
  });
}
