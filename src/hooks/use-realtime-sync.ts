'use client';

// ============================================================================
// عافيتك (Aafiatak) - Real-time Sync Hook
// ============================================================================
// Provides real-time synchronization for all entities (deployments, orders,
// emergencies, etc.) via Socket.IO events. Invalidates React Query cache
// automatically when data changes, ensuring ALL users (including the
// action performer) see updates instantly.
// ============================================================================

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socketService as socketServiceV2 } from '@/lib/socket-v2';
import type {
  DeploymentUpdatedEvent,
  ApplicationUpdatedEvent,
  PaymentUpdatedEvent,
  DataChangeEvent,
} from '@/lib/socket-v2';
import { useAuthStore } from '@/lib/stores/auth-store';

/**
 * Hook for real-time synchronization of data.
 * 
 * Listens for socket events and invalidates React Query cache
 * to trigger background refetches. This ensures:
 * 1. The action performer (SELF) sees their changes instantly
 * 2. Other users see changes in real-time
 * 3. No manual refresh is needed
 * 
 * This hook should be used ONCE at the app root level (inside AppProvider).
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isConnectedRef = useRef(false);

  // Track connection state
  useEffect(() => {
    const unsub = socketServiceV2.onConnectionStateChange((state) => {
      isConnectedRef.current = state === 'connected';
    });
    return unsub;
  }, []);

  // ======== Deployment Events ========
  useEffect(() => {
    const unsubDeployment = socketServiceV2.onDeploymentUpdated((data: DeploymentUpdatedEvent) => {
      // Invalidate both the list and the specific deployment
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      queryClient.invalidateQueries({ queryKey: ['deployment', data.deploymentId] });

      // If we have full deployment data, update the cache immediately (optimistic)
      if (data.deployment) {
        queryClient.setQueryData(['deployment', data.deploymentId], (old: any) => {
          if (!old) return data.deployment;
          return { ...old, ...data.deployment };
        });
      }
    });

    const unsubApplication = socketServiceV2.onApplicationUpdated((data: ApplicationUpdatedEvent) => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      queryClient.invalidateQueries({ queryKey: ['deployment', data.deploymentId] });
    });

    const unsubPayment = socketServiceV2.onPaymentUpdated((data: PaymentUpdatedEvent) => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      queryClient.invalidateQueries({ queryKey: ['deployment', data.deploymentId] });
    });

    return () => {
      unsubDeployment();
      unsubApplication();
      unsubPayment();
    };
  }, [queryClient]);

  // ======== Generic Data Change Events ========
  useEffect(() => {
    const unsubDataChange = socketServiceV2.onDataChange((data: DataChangeEvent) => {
      switch (data.entity) {
        case 'deployment':
          queryClient.invalidateQueries({ queryKey: ['deployments'] });
          queryClient.invalidateQueries({ queryKey: ['deployment', data.entityId] });
          break;
        case 'application':
          // Application changes affect the parent deployment
          queryClient.invalidateQueries({ queryKey: ['deployments'] });
          break;
        case 'payment':
          queryClient.invalidateQueries({ queryKey: ['deployments'] });
          break;
        case 'order':
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          queryClient.invalidateQueries({ queryKey: ['order', data.entityId] });
          break;
        case 'emergency':
          queryClient.invalidateQueries({ queryKey: ['emergencies'] });
          queryClient.invalidateQueries({ queryKey: ['emergency', data.entityId] });
          break;
        case 'user':
          queryClient.invalidateQueries({ queryKey: ['users'] });
          queryClient.invalidateQueries({ queryKey: ['user', data.entityId] });
          break;
        case 'notification':
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          break;
      }
    });

    return unsubDataChange;
  }, [queryClient]);

  // ======== Order Events (existing - now with cache invalidation) ========
  useEffect(() => {
    const unsubCreated = socketServiceV2.onOrderCreated(() => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    });

    const unsubAssigned = socketServiceV2.onOrderAssigned((data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', data.requestId] });
    });

    const unsubStatus = socketServiceV2.onOrderStatusChanged((data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', data.requestId] });
    });

    const unsubCancelled = socketServiceV2.onOrderCancelled((data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', data.requestId] });
    });

    return () => {
      unsubCreated();
      unsubAssigned();
      unsubStatus();
      unsubCancelled();
    };
  }, [queryClient]);

  // ======== Emergency Events (existing - now with cache invalidation) ========
  useEffect(() => {
    const unsubCreated = socketServiceV2.onEmergencyCreated(() => {
      queryClient.invalidateQueries({ queryKey: ['emergencies'] });
    });

    const unsubDispatched = socketServiceV2.onEmergencyDispatched((data) => {
      queryClient.invalidateQueries({ queryKey: ['emergencies'] });
      queryClient.invalidateQueries({ queryKey: ['emergency', data.emergencyRequestId] });
    });

    const unsubResolved = socketServiceV2.onEmergencyResolved((data) => {
      queryClient.invalidateQueries({ queryKey: ['emergencies'] });
      queryClient.invalidateQueries({ queryKey: ['emergency', data.emergencyRequestId] });
    });

    const unsubCancelled = socketServiceV2.onEmergencyCancelled((data) => {
      queryClient.invalidateQueries({ queryKey: ['emergencies'] });
      queryClient.invalidateQueries({ queryKey: ['emergency', data.emergencyRequestId] });
    });

    return () => {
      unsubCreated();
      unsubDispatched();
      unsubResolved();
      unsubCancelled();
    };
  }, [queryClient]);

  // ======== Utility: Emit events with self-sync ========
  // When a user performs an action, emit the event AND apply the change locally
  // so the UI updates instantly (optimistic) before the server confirms.

  const emitDeploymentChange = useCallback((
    deploymentId: string,
    status: string,
    deployment?: Record<string, unknown>
  ) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    const event: DeploymentUpdatedEvent = {
      deploymentId,
      status: status as DeploymentUpdatedEvent['status'],
      updatedBy: currentUser.id,
      updatedByRole: currentUser.role as DeploymentUpdatedEvent['updatedByRole'],
      updatedAt: new Date().toISOString(),
      deployment: deployment || {},
    };

    socketServiceV2.emitDeploymentUpdated(event);

    // Self-sync: invalidate our own cache immediately
    queryClient.invalidateQueries({ queryKey: ['deployments'] });
    queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] });
  }, [queryClient]);

  const emitApplicationChange = useCallback((
    deploymentId: string,
    applicationId: string,
    applicantId: string,
    status: string
  ) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    const event: ApplicationUpdatedEvent = {
      deploymentId,
      applicationId,
      applicantId,
      status: status as ApplicationUpdatedEvent['status'],
      updatedBy: currentUser.id,
      updatedByRole: currentUser.role as ApplicationUpdatedEvent['updatedByRole'],
      updatedAt: new Date().toISOString(),
    };

    socketServiceV2.emitApplicationUpdated(event);

    // Self-sync
    queryClient.invalidateQueries({ queryKey: ['deployments'] });
    queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] });
  }, [queryClient]);

  const emitPaymentChange = useCallback((
    deploymentId: string,
    applicationId: string,
    applicantId: string,
    status: string,
    paymentAction: string
  ) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    const event: PaymentUpdatedEvent = {
      deploymentId,
      applicationId,
      applicantId,
      status: status as PaymentUpdatedEvent['status'],
      paymentAction,
      updatedBy: currentUser.id,
      updatedByRole: currentUser.role as PaymentUpdatedEvent['updatedByRole'],
      updatedAt: new Date().toISOString(),
    };

    socketServiceV2.emitPaymentUpdated(event);

    // Self-sync
    queryClient.invalidateQueries({ queryKey: ['deployments'] });
    queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] });
  }, [queryClient]);

  return {
    emitDeploymentChange,
    emitApplicationChange,
    emitPaymentChange,
  };
}
