import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSecure, setSecure } from './secure-store';
import { registerPushToken, unregisterPushToken } from './api';
import { SECURE_STORE_KEYS } from '../constants';

const PROJECT_ID = '75f1fe16-44e3-45b4-a0c0-66182a5bf5c6';

// How notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function createAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'PersonalClaw',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1a1a1a',
  });
}

async function registerCategories(): Promise<void> {
  // Inline action buttons for proposal notifications
  await Notifications.setNotificationCategoryAsync('proposal', [
    {
      identifier: 'approve',
      buttonTitle: 'Approve',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
    {
      identifier: 'reject',
      buttonTitle: 'Reject',
      options: { isDestructive: true, isAuthenticationRequired: false },
    },
  ]);

  // Inline action button for blocker notifications
  await Notifications.setNotificationCategoryAsync('blocker', [
    {
      identifier: 'resolve',
      buttonTitle: 'Mark Resolved',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
  ]);
}

export async function initPushNotifications(): Promise<string | null> {
  try {
    await createAndroidChannel();
    await registerCategories();

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    const token = tokenData.data;

    // Only re-register if token changed
    const stored = await getSecure(SECURE_STORE_KEYS.PUSH_TOKEN);
    if (stored !== token) {
      if (stored) {
        await unregisterPushToken(stored).catch(() => {});
      }
      await registerPushToken(token);
      await setSecure(SECURE_STORE_KEYS.PUSH_TOKEN, token);
      console.log('[Push] Token registered:', token.slice(0, 40) + '...');
    }

    return token;
  } catch (err) {
    console.warn('[Push] Init failed:', err);
    return null;
  }
}

export async function teardownPushNotifications(): Promise<void> {
  try {
    const token = await getSecure(SECURE_STORE_KEYS.PUSH_TOKEN);
    if (token) {
      await unregisterPushToken(token).catch(() => {});
    }
  } catch {
    // ignore
  }
}
