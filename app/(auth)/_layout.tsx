import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#fff' },
      }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="email-confirmation" />
      <Stack.Screen name="onboarding-name" />
      <Stack.Screen name="onboarding-username" />
    </Stack>
  );
}

