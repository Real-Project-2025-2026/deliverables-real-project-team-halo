import { Stack } from 'expo-router';

export default function TripLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F9F9F9' },
      }}>
      <Stack.Screen name="start" />
      <Stack.Screen name="active" />
    </Stack>
  );
}

