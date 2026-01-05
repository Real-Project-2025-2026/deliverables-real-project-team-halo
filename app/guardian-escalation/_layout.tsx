import { Stack } from 'expo-router';

export default function GuardianEscalationLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[tripId]" />
    </Stack>
  );
}

