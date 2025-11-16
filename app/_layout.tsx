import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/providers/auth-provider';
import {
  addNotificationResponseReceivedListener,
} from '@/services/notification-service';

export const unstable_settings = {
  initialRouteName: 'index',
};

function NotificationHandler() {
  const router = useRouter();

  useEffect(() => {
    // Handle notification taps
    const subscription = addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;

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
