import { useEffect, useRef, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../store';
import { socketService } from '../services/socket';
import { useChatStore, useOrgStore, useActivityStore, useMetricsStore, useConnectionStore } from '../store';
import { initPushNotifications } from '../services/push-notifications';
import type { PushNotificationData } from '../types';

function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): void {
  const data = response.notification.request.content.data as PushNotificationData | undefined;
  const action = response.actionIdentifier;

  // Inline action buttons
  if (action === 'approve' && data?.orgId && data?.proposalId) {
    socketService.send('org:proposal:action', {
      orgId: data.orgId,
      proposalId: data.proposalId,
      action: 'approve',
    });
    return;
  }

  if (action === 'reject' && data?.orgId && data?.proposalId) {
    socketService.send('org:proposal:action', {
      orgId: data.orgId,
      proposalId: data.proposalId,
      action: 'reject',
    });
    return;
  }

  if (action === 'resolve' && data?.orgId) {
    const blockerId = (data as any).blockerId;
    if (blockerId) {
      socketService.send('org:blocker:resolve', { orgId: data.orgId, blockerId });
    }
    return;
  }

  // Default tap — deep-link to relevant screen
  if (!data) return;

  if (data.type === 'blocker' && data.orgId) {
    router.push({ pathname: '/org/[orgId]', params: { orgId: data.orgId, tab: 'blockers' } });
    return;
  }

  if (data.type === 'proposal' && data.orgId) {
    router.push({ pathname: '/org/[orgId]', params: { orgId: data.orgId, tab: 'proposals' } });
    return;
  }

  if (data.type === 'chat_response') {
    router.push('/');
    return;
  }

  if ((data.type === 'task_complete' || data.type === 'worker_failed') && data.agentId) {
    router.push('/');
    return;
  }
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const setConnected = useConnectionStore(s => s.setConnected);
  const setConversations = useChatStore(s => s.setConversations);
  const setMessages = useChatStore(s => s.setMessages);
  const addMessage = useChatStore(s => s.addMessage);
  const addToolUpdate = useChatStore(s => s.addToolUpdate);
  const setWorkers = useChatStore(s => s.setWorkers);
  const setThinking = useChatStore(s => s.setThinking);
  const setOrgs = useOrgStore(s => s.setOrgs);
  const upsertOrg = useOrgStore(s => s.upsertOrg);
  const removeOrg = useOrgStore(s => s.removeOrg);
  const addActivity = useActivityStore(s => s.addItem);
  const setMetrics = useMetricsStore(s => s.setMetrics);

  const notifResponseSub = useRef<Notifications.Subscription | null>(null);
  const notifReceivedSub = useRef<Notifications.Subscription | null>(null);

  // Initialize socket and wire up all global events
  useEffect(() => {
    socketService.init();

    const unsubs = [
      socketService.on('connect', () => setConnected(true)),
      socketService.on('disconnect', () => setConnected(false)),

      socketService.on('init', (data: any) => {
        if (data.conversations) {
          setConversations(data.conversations);
          // Restore message history and reset thinking state for each conversation
          for (const convo of data.conversations) {
            if (convo.messages?.length) {
              setMessages(convo.id, convo.messages);
            }
            setThinking(convo.id, false);
          }
        }
        if (data.orgs) setOrgs(data.orgs);
        if (data.metrics) setMetrics(data.metrics);
      }),

      socketService.on('response', (data: any) => {
        setThinking(data.conversationId, false);
        addMessage(data.conversationId, {
          role: 'assistant',
          content: data.text,
          timestamp: Date.now(),
        });
      }),

      socketService.on('chat:tool_feed', (data: any) => addToolUpdate(data)),
      socketService.on('tool_update', (data: any) => addToolUpdate(data)),

      socketService.on('agent:update', (data: any) => {
        if (data.conversationId) setWorkers(data.conversationId, data.workers ?? []);
      }),

      socketService.on('metrics', (data: any) => setMetrics(data)),
      socketService.on('activity', (data: any) => addActivity(data)),

      socketService.on('org:list', (orgs: any[]) => setOrgs(orgs)),
      socketService.on('org:created', (org: any) => upsertOrg(org)),
      socketService.on('org:updated', (org: any) => upsertOrg(org)),
      socketService.on('org:deleted', ({ orgId }: any) => removeOrg(orgId)),

      socketService.on('conversation:created', (convo: any) => {
        const current = useChatStore.getState().conversations;
        if (!current.some(c => c.id === convo.id)) {
          setConversations([...current, convo]);
        }
      }),

      socketService.on('conversation:list', (convos: any[]) => setConversations(convos)),
    ];

    return () => {
      unsubs.forEach(fn => fn());
      socketService.destroy();
    };
  }, []);

  // Auth guard — wait one tick for navigator to mount before redirecting
  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [ready, isAuthenticated]);

  // Init push notifications once authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    initPushNotifications();

    // Handle notification tap (app in background/killed)
    notifResponseSub.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );

    // Log foreground notifications (they already show as banners via setNotificationHandler)
    notifReceivedSub.current = Notifications.addNotificationReceivedListener((notif) => {
      console.log('[Push] Foreground notification:', notif.request.content.title);
    });

    // Handle notification that launched the app from killed state
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response);
    });

    return () => {
      notifResponseSub.current?.remove();
      notifReceivedSub.current?.remove();
    };
  }, [isAuthenticated]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="org/[orgId]" />
      </Stack>
    </>
  );
}
