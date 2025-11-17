import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/providers/auth-provider';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PlanType = 'monthly' | 'annually';

export default function AbonnementScreen() {
  const { user, profile } = useAuth();
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

  // Subscription Selection Overlay Component
  const SubscriptionOverlay = () => (
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
            onPress={() => setShowSubscriptionModal(false)}
            activeOpacity={0.7}>
            <Text style={styles.closeButtonText}>×</Text>
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
            <IconSymbol name="checkmark" size={20} color="#fff" />
            <Text style={styles.featureText}>Unlimited Trips</Text>
          </View>
          <View style={styles.featureItem}>
            <IconSymbol name="checkmark" size={20} color="#fff" />
            <Text style={styles.featureText}>24/7 Emergency Response</Text>
          </View>
          <View style={styles.featureItem}>
            <IconSymbol name="checkmark" size={20} color="#fff" />
            <Text style={styles.featureText}>Real-time Location Sharing</Text>
          </View>
          <View style={styles.featureItem}>
            <IconSymbol name="checkmark" size={20} color="#fff" />
            <Text style={styles.featureText}>Priority Support</Text>
          </View>
          <View style={styles.featureItem}>
            <IconSymbol name="checkmark" size={20} color="#fff" />
            <Text style={styles.featureText}>Trip History & Analytics</Text>
          </View>
          <View style={styles.featureItem}>
            <IconSymbol name="checkmark" size={20} color="#fff" />
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
            onPress={() => setSelectedPlan('monthly')}
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
            onPress={() => setSelectedPlan('annually')}
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Subscription</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.userAvatarContainer}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}>
            {renderUserAvatar()}
          </TouchableOpacity>
        </View>
      </View>

      {hasActiveSubscription ? (
        // TODO: Show subscription details when user has active subscription
        <View style={styles.centerContent}>
          <Text style={styles.centerText}>Your subscription is active</Text>
        </View>
      ) : (
        // No subscription - show call to action
        <View style={styles.centerContent}>
          <IconSymbol name="creditcard" size={64} color="rgba(255, 255, 255, 0.5)" />
          <Text style={styles.centerTitle}>No Subscription</Text>
          <Text style={styles.centerSubtitle}>
            Upgrade to Premium to unlock all features
          </Text>
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => setShowSubscriptionModal(true)}
            activeOpacity={0.8}>
            <Text style={styles.upgradeButtonText}>Choose a Plan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Subscription Selection Modal Overlay */}
      <Modal
        visible={showSubscriptionModal}
        transparent={false}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => setShowSubscriptionModal(false)}>
        <SubscriptionOverlay />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5170FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userAvatarPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: '#5170FF',
  },
  imageContainer: {
    width: '100%',
    height: '40%',
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
    backgroundColor: 'rgba(81, 112, 255, 0.95)',
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    marginTop: -20,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: -20,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 0,
    textAlign: 'center',
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 0,
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    flex: 1,
  },
  plansContainer: {
    gap: 12,
    marginBottom: 0,
  },
  planOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    padding: 16,
  },
  planOptionSelected: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
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
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
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
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#fff',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  continueButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#5170FF',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  centerText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
  },
  centerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  centerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  upgradeButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 200,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#5170FF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#5170FF',
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
  closeButtonText: {
    fontSize: 32,
    color: '#fff',
    lineHeight: 32,
    fontWeight: '300',
  },
});

