import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors, radii, shadows, spacing, typography } from '@/constants/design-tokens';
import type { TripGuardianWithDetails } from '@/services/trip-guardian-service';

interface GuardianRequestCardProps {
  request: TripGuardianWithDetails;
  onAccept: (requestId: number) => Promise<boolean>;
  onDecline: (requestId: number) => Promise<boolean>;
}

/**
 * Card that appears in the Home screen when someone requests you as a Guardian
 */
export function GuardianRequestCard({
  request,
  onAccept,
  onDecline,
}: GuardianRequestCardProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  const handleAccept = async () => {
    if (isAccepting || isDeclining) return;
    setIsAccepting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const success = await onAccept(request.id);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error accepting guardian request:', error);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (isAccepting || isDeclining) return;
    setIsDeclining(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await onDecline(request.id);
    } catch (error) {
      console.error('Error declining guardian request:', error);
    } finally {
      setIsDeclining(false);
    }
  };

  // Trip owner is the person who wants you as their guardian
  const tripOwner = request.trip_owner;
  const requesterName = tripOwner?.full_name || tripOwner?.username || 'Jemand';
  const destination = request.trip?.destination_address?.split(',')[0] || 'Unbekanntes Ziel';

  return (
    <View style={styles.container}>
      {/* Trip Owner Info */}
      <View style={styles.requesterContainer}>
        <View style={styles.avatar}>
          {tripOwner?.avatar_url ? (
            <Image source={{ uri: tripOwner.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {requesterName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.requesterInfo}>
          <Text style={styles.requesterName}>{requesterName}</Text>
          <Text style={styles.tripInfo}>
            möchte dich als Guardian für einen Trip nach{' '}
            <Text style={styles.destination}>{destination}</Text>
          </Text>
        </View>
      </View>

      {/* Trip Details */}
      <View style={styles.tripDetails}>
        <View style={styles.tripDetail}>
          <IconSymbol name="clock" size={14} color={colors.text.tertiary} />
          <Text style={styles.tripDetailText}>
            Check-in alle {request.trip?.checkin_interval_minutes || 5} Min.
          </Text>
        </View>
        <View style={styles.tripDetail}>
          <IconSymbol name="location.fill" size={14} color={colors.text.tertiary} />
          <Text style={styles.tripDetailText} numberOfLines={1}>
            {request.trip?.origin_address?.split(',')[0] || 'Start'} → {destination}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.declineButton}
          onPress={handleDecline}
          disabled={isAccepting || isDeclining}
          activeOpacity={0.8}
        >
          {isDeclining ? (
            <ActivityIndicator size="small" color={colors.text.secondary} />
          ) : (
            <Text style={styles.declineButtonText}>Ablehnen</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.acceptButton}
          onPress={handleAccept}
          disabled={isAccepting || isDeclining}
          activeOpacity={0.8}
        >
          {isAccepting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <IconSymbol name="checkmark" size={18} color="#fff" />
              <Text style={styles.acceptButtonText}>Annehmen</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral[0],
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  timestamp: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.text.tertiary,
  },
  requesterContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.primary[600],
  },
  requesterInfo: {
    flex: 1,
  },
  requesterName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  tripInfo: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.regular,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  destination: {
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  tripDetails: {
    backgroundColor: colors.neutral[50],
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tripDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tripDetailText: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.secondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  declineButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.secondary,
  },
  acceptButton: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.md,
    shadowColor: colors.primary[500],
    shadowOpacity: 0.3,
  },
  acceptButtonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: '#fff',
  },
});

