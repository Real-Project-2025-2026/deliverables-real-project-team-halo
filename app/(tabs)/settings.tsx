import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';

type PlanType = 'monthly' | 'annually';

export default function SettingsScreen() {
  const { user, profile, signOut } = useAuth();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly');
  
  // TODO: Check if user has active subscription
  const hasActiveSubscription = false;

  // Render user avatar (for header)
  const renderUserAvatar = useCallback(() => {
    const firstLetter = (profile?.username || profile?.full_name || user?.email || '?')[0].toUpperCase();
    const avatarUrl = profile?.avatar_url;

    if (avatarUrl) {
      return (
        <Image
          source={{ uri: avatarUrl }}
          style={styles.userAvatarImage}
          contentFit="cover"
          transition={200}
        />
      );
    }

    return (
      <View style={[styles.userAvatarContainer, styles.userAvatarPlaceholder]}>
        <Text style={styles.userAvatarText}>{firstLetter}</Text>
      </View>
    );
  }, [profile, user]);

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.userAvatarContainer}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}>
            {renderUserAvatar()}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* User Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.iconContainer, { backgroundColor: '#5170FF' }]}>
                <IconSymbol name="person.fill" size={20} color="#fff" />
              </View>
              <View style={styles.info}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{user?.email}</Text>
              </View>
            </View>
          </View>
          {profile?.full_name && (
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={[styles.iconContainer, { backgroundColor: '#5170FF' }]}>
                  <IconSymbol name="person.circle" size={20} color="#fff" />
                </View>
                <View style={styles.info}>
                  <Text style={styles.label}>Name</Text>
                  <Text style={styles.value}>{profile.full_name}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Emergency Contacts Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety</Text>
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/emergency-contacts')}
            activeOpacity={0.7}>
            <View style={styles.row}>
              <View style={[styles.iconContainer, { backgroundColor: '#FF9800' }]}>
                <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#fff" />
              </View>
              <View style={styles.info}>
                <Text style={styles.label}>Emergency Contacts</Text>
                <Text style={styles.subtitle}>Manage trusted contacts</Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color="#999" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Safety Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.iconContainer, { backgroundColor: '#34C759' }]}>
                <IconSymbol name="timer" size={20} color="#fff" />
              </View>
              <View style={styles.info}>
                <Text style={styles.label}>Check-in Interval</Text>
                <Text style={styles.subtitle}>
                  {profile?.default_checkin_interval_minutes || 5} minutes
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.iconContainer, { backgroundColor: '#FF3B30' }]}>
                <IconSymbol name="shield.fill" size={20} color="#fff" />
              </View>
              <View style={styles.info}>
                <Text style={styles.label}>Default Trip Mode</Text>
                <Text style={styles.subtitle}>
                  {profile?.default_trip_mode || 'interval'}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.iconContainer, { backgroundColor: '#5170FF' }]}>
                <IconSymbol name="person.2.fill" size={20} color="#fff" />
              </View>
              <View style={styles.info}>
                <Text style={styles.label}>SafeTogether</Text>
                <Text style={styles.subtitle}>
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
              <View style={[styles.iconContainer, { backgroundColor: '#666' }]}>
                <IconSymbol name="clock" size={20} color="#fff" />
              </View>
              <View style={styles.info}>
                <Text style={styles.label}>Data Retention</Text>
                <Text style={styles.subtitle}>
                  {profile?.data_retention_days || 30} days
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <TouchableOpacity
            style={styles.card}
            onPress={() => setShowSubscriptionModal(true)}
            activeOpacity={0.7}>
            <View style={styles.row}>
              <View style={[styles.iconContainer, { backgroundColor: '#FFD700' }]}>
                <IconSymbol name="star.fill" size={20} color="#fff" />
              </View>
              <View style={styles.info}>
                <Text style={styles.label}>Subscription</Text>
                <Text style={styles.subtitle}>
                  {hasActiveSubscription ? 'Active' : 'Upgrade to Premium'}
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color="#999" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <IconSymbol name="arrow.right.square" size={20} color="#FF3B30" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Subscription Selection Modal */}
      <Modal
        visible={showSubscriptionModal}
        transparent={false}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => setShowSubscriptionModal(false)}>
        <SubscriptionOverlay
          selectedPlan={selectedPlan}
          onSelectPlan={setSelectedPlan}
          onClose={() => setShowSubscriptionModal(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

// Subscription Selection Overlay Component
function SubscriptionOverlay({
  selectedPlan,
  onSelectPlan,
  onClose,
}: {
  selectedPlan: PlanType;
  onSelectPlan: (plan: PlanType) => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.overlayContainer}>
      {/* Image - takes up less space */}
      <View style={styles.imageContainer}>
        <Image
          source={require('@/assets/images/subscription.jpg')}
          style={styles.subscriptionImage}
          contentFit="cover"
        />
        {/* Close Button on Image */}
        <SafeAreaView style={styles.closeButtonContainer} edges={['top']}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}>
            <IconSymbol name="xmark" size={20} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      {/* Subscription Card - takes up more space, no scroll needed */}
      <View style={styles.subscriptionCard}>
        <Text style={styles.cardTitle}>Choose a plan</Text>
        <Text style={styles.cardSubtitle}>Monthly or yearly? It's your call</Text>

        {/* Features List */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <View style={styles.checkmarkCircle}>
              <IconSymbol name="checkmark" size={14} color="#34C759" />
            </View>
            <Text style={styles.featureText}>Unlimited Trips</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={styles.checkmarkCircle}>
              <IconSymbol name="checkmark" size={14} color="#34C759" />
            </View>
            <Text style={styles.featureText}>24/7 Emergency Response</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={styles.checkmarkCircle}>
              <IconSymbol name="checkmark" size={14} color="#34C759" />
            </View>
            <Text style={styles.featureText}>Real-time Location Sharing</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={styles.checkmarkCircle}>
              <IconSymbol name="checkmark" size={14} color="#34C759" />
            </View>
            <Text style={styles.featureText}>Priority Support</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={styles.checkmarkCircle}>
              <IconSymbol name="checkmark" size={14} color="#34C759" />
            </View>
            <Text style={styles.featureText}>Trip History & Analytics</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={styles.checkmarkCircle}>
              <IconSymbol name="checkmark" size={14} color="#34C759" />
            </View>
            <Text style={styles.featureText}>Custom Check-in Intervals</Text>
          </View>
        </View>

        {/* Plan Options - positioned near bottom */}
        <View style={styles.plansContainer}>
          {/* Monthly Plan */}
          <TouchableOpacity
            style={[
              styles.planOption,
              selectedPlan === 'monthly' && styles.planOptionSelected,
            ]}
            onPress={() => onSelectPlan('monthly')}
            activeOpacity={0.7}>
            <View style={styles.planContent}>
              <View style={styles.planLeft}>
                <Text style={styles.planName}>Monthly</Text>
                <Text style={styles.planPrice}>€4,99 /month</Text>
              </View>
              <View
                style={[
                  styles.radioButton,
                  selectedPlan === 'monthly' && styles.radioButtonSelected,
                ]}>
                {selectedPlan === 'monthly' && (
                  <View style={styles.radioButtonInner} />
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* Annually Plan */}
          <TouchableOpacity
            style={[
              styles.planOption,
              selectedPlan === 'annually' && styles.planOptionSelected,
            ]}
            onPress={() => onSelectPlan('annually')}
            activeOpacity={0.7}>
            <View style={styles.planContent}>
              <View style={styles.planLeft}>
                <View style={styles.planNameRow}>
                  <Text style={styles.planName}>Annually</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Save 10%</Text>
                  </View>
                </View>
                <Text style={styles.planPrice}>€53,99 /year</Text>
              </View>
              <View
                style={[
                  styles.radioButton,
                  selectedPlan === 'annually' && styles.radioButtonSelected,
                ]}>
                {selectedPlan === 'annually' && (
                  <View style={styles.radioButtonInner} />
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Continue Button */}
        <TouchableOpacity style={styles.continueButton} activeOpacity={0.8}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userAvatarPlaceholder: {
    backgroundColor: '#5170FF',
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
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
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  value: {
    fontSize: 14,
    color: '#666',
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
    marginTop: 8,
    marginBottom: 24,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  imageContainer: {
    width: '100%',
    height: '35%',
    overflow: 'hidden',
    position: 'relative',
  },
  closeButtonContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
  },
  subscriptionImage: {
    width: '100%',
    height: '100%',
  },
  subscriptionCard: {
    backgroundColor: '#fff',
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    marginTop: -20,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    gap: 8,
  },
  checkmarkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    color: '#000',
    flex: 1,
  },
  plansContainer: {
    gap: 12,
    marginBottom: 24,
  },
  planOption: {
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    padding: 16,
  },
  planOptionSelected: {
    borderColor: '#5170FF',
    backgroundColor: '#F0F4FF',
  },
  planContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planLeft: {
    flex: 1,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  badge: {
    backgroundColor: '#FF6B9D',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  planPrice: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#5170FF',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#5170FF',
  },
  continueButton: {
    backgroundColor: '#5170FF',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5170FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginRight: 24,
  },
});
