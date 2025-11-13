import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function SettingsScreen() {
  const { user, profile, signOut } = useAuth();

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.content}>
        {/* User Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconContainer}>
                <IconSymbol name="person.fill" size={20} color="#5170FF" />
              </View>
              <View style={styles.info}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{user?.email}</Text>
              </View>
            </View>
            {profile?.full_name && (
              <View style={styles.row}>
                <View style={styles.iconContainer}>
                  <IconSymbol name="person.circle" size={20} color="#5170FF" />
                </View>
                <View style={styles.info}>
                  <Text style={styles.label}>Name</Text>
                  <Text style={styles.value}>{profile.full_name}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Safety Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety Preferences</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconContainer}>
                <IconSymbol name="timer" size={20} color="#5170FF" />
              </View>
              <View style={styles.info}>
                <Text style={styles.label}>Default Check-in Interval</Text>
                <Text style={styles.value}>
                  {profile?.default_checkin_interval_minutes || 5} minutes
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.iconContainer}>
                <IconSymbol name="shield.fill" size={20} color="#5170FF" />
              </View>
              <View style={styles.info}>
                <Text style={styles.label}>Default Trip Mode</Text>
                <Text style={styles.value}>
                  {profile?.default_trip_mode || 'interval'}
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.iconContainer}>
                <IconSymbol name="person.2.fill" size={20} color="#5170FF" />
              </View>
              <View style={styles.info}>
                <Text style={styles.label}>SafeTogether</Text>
                <Text style={styles.value}>
                  {profile?.safetogether_enabled ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconContainer}>
                <IconSymbol name="clock" size={20} color="#5170FF" />
              </View>
              <View style={styles.info}>
                <Text style={styles.label}>Data Retention</Text>
                <Text style={styles.value}>
                  {profile?.data_retention_days || 30} days
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <IconSymbol name="arrow.right.square" size={20} color="#FF3B30" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#5170FF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FF3B30',
    gap: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
});

