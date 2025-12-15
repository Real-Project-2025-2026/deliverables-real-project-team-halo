import { Stack } from 'expo-router';

export default function GuardianTripLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#5170FF' },
      }}>
      <Stack.Screen name="[id]" />
    </Stack>
  );
}










