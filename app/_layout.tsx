import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/providers/auth-provider';
import {
  addNotificationResponseReceivedListener,
  registerNotificationCategories,
} from '@/services/notification-service';
import { respondToCheckin, getPendingCheckins } from '@/services/checkin-service';
import { hapticFeedback } from '@/services/haptic-service';
import { setupActionButtonListener } from '@/services/action-button-service';
import { useTrip } from '@/hooks/use-trip';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';

export const unstable_settings = {
  initialRouteName: 'index',
};

function NotificationHandler() {
  const router = useRouter();
  const { activeTrip } = useTrip();

  useEffect(() => {
    // Register notification categories on app start (CRITICAL: must be done before any notifications are sent)
    registerNotificationCategories()
      .then(() => {
        console.log('[Notification Handler] Categories registered successfully');
      })
      .catch((error) => {
        console.error('[Notification Handler] Error registering categories:', error);
      });
  }, []);

  // Setup Action Button listener for App Intents
  useEffect(() => {
    const cleanup = setupActionButtonListener(
      async (response: 'ok' | 'help', checkinId: number) => {
        try {
          await hapticFeedback(response === 'ok' ? 'success' : 'error');
          const { error } = await respondToCheckin(checkinId, response);
          if (error) {
            console.error('[Action Button] Error responding to check-in:', error);
          } else {
            console.log('[Action Button] Check-in confirmed:', response);
            if (response === 'help') {
              router.push('/trip/active');
            }
          }
        } catch (error) {
          console.error('[Action Button] Error handling check-in response:', error);
        }
      },
      async () => {
        // Get active trip from Supabase
        if (!activeTrip) return null;
        return { id: activeTrip.id };
      }
    );

    return cleanup;
  }, [router, activeTrip]);

  useEffect(() => {
    // Handle notification taps and actions
    const subscription = addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      const actionIdentifier = response.actionIdentifier;

      // Handle Check-in notification actions
      if (data?.type === 'checkin' && data?.checkinId) {
        const checkinId = data.checkinId as number;

        if (actionIdentifier === 'CHECKIN_OK') {
          // User tapped "I'm OK" button
          try {
            await hapticFeedback('success');
            const { error } = await respondToCheckin(checkinId, 'ok');
            if (error) {
              console.error('[Notification Handler] Error responding to check-in:', error);
            } else {
              console.log('[Notification Handler] Check-in confirmed: OK');
              // Emit event to refresh pending check-in state in active trip screen
              // This will be handled by the useCheckinTimer hook when the screen is active
            }
          } catch (error) {
            console.error('[Notification Handler] Error handling check-in OK:', error);
          }
          return; // Don't navigate, action was handled
        } else if (actionIdentifier === 'CHECKIN_HELP') {
          // User tapped "Need Help" button
          try {
            await hapticFeedback('error');
            const { error } = await respondToCheckin(checkinId, 'help');
            if (error) {
              console.error('[Notification Handler] Error responding to check-in:', error);
            } else {
              console.log('[Notification Handler] Check-in confirmed: HELP');
              // Navigate to active trip screen to show emergency state
              router.push('/trip/active');
            }
          } catch (error) {
            console.error('[Notification Handler] Error handling check-in HELP:', error);
          }
          return; // Action was handled
        } else if (!actionIdentifier || actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          // User tapped the notification itself (not an action button)
          // Navigate to active trip screen
          router.push('/trip/active');
          return;
        }
      }

      // Handle other notification types (Guardian requests, etc.)
      if (data?.type === 'guardian_request') {
        // Navigate to Safe Together tab with Requests tab open
        router.push('/(tabs)/explore?tab=requests');
      } else if (data?.type === 'guardian_accepted') {
        // Navigate to Safe Together tab with Guardians tab open
        router.push('/(tabs)/explore?tab=guardians');
      } else if (data?.type === 'guardian_trip_started' && data?.tripId) {
        // Navigate to Guardian Trip Detail Screen
        router.push(`/guardian-trip/${data.tripId}`);
      }
    });

    return () => subscription.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <NotificationHandler />
        <Stack
          screenOptions={{
            headerShown: false,
          }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="emergency-contacts" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="trip" />
          <Stack.Screen name="guardian-trip" />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
