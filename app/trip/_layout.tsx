import { Stack } from 'expo-router';

export default function TripLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#fff' },
      }}>
      <Stack.Screen name="start" />
      <Stack.Screen name="setup" />
      <Stack.Screen name="route-setup" />
      <Stack.Screen name="destination-search" />
      <Stack.Screen name="active" />
    </Stack>
  );
}

