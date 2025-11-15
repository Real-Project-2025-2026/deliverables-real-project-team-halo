import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';

export default function Index() {
  const { session, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (session) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [session, isLoading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#5170FF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5170FF',
  },
});

