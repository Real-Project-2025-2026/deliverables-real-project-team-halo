import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors, spacing, typography, radii, shadows } from '@/constants/design-tokens';

interface GuardianEscalationCardProps {
  userName: string;
  userAvatar?: string | null;
  destination?: string | null;
  missedCheckins: number;
  onPress: () => void;
}

export function GuardianEscalationCard({
  userName,
  userAvatar,
  destination,
  missedCheckins,
  onPress,
}: GuardianEscalationCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Emergency Badge */}
      <View style={styles.emergencyBadge}>
        <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#fff" />
        <Text style={styles.emergencyBadgeText}>EMERGENCY</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.userName}>{userName}</Text>
          {destination && (
            <Text style={styles.destination} numberOfLines={1}>
              {destination}
            </Text>
          )}
        </View>

        {/* Emergency Reason Info */}
        {missedCheckins >= 2 ? (
          <View style={styles.infoRow}>
            <IconSymbol name="clock.fill" size={14} color={colors.error.main} />
            <Text style={styles.infoText}>
              {missedCheckins} {missedCheckins === 1 ? 'missed check-in' : 'missed check-ins'}
            </Text>
          </View>
        ) : (
          <View style={styles.infoRow}>
            <IconSymbol name="exclamationmark.triangle.fill" size={14} color={colors.error.main} />
            <Text style={styles.infoText}>Emergency button pressed</Text>
          </View>
        )}

        {/* Action Hint */}
        <View style={styles.actionRow}>
          <Text style={styles.actionText}>Tap to view location and help</Text>
          <IconSymbol name="chevron.right" size={18} color={colors.primary[500]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.error.light,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.error.main,
    ...shadows.md,
  },
  emergencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error.main,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  emergencyBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  content: {
    gap: spacing.sm,
  },
  header: {
    gap: spacing.xs,
  },
  userName: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  destination: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.secondary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.error.main,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  actionText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.primary[500],
  },
});

