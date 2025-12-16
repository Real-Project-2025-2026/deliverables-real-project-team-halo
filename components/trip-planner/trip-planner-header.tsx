import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, colors, typography, radii, touchTargets } from '@/constants/design-tokens';

interface TripPlannerHeaderProps {
  /** Titel des Headers */
  title: string;
  /** Callback beim Schließen */
  onClose: () => void;
  /** Optionaler Progress (z.B. "Step 1 of 2") */
  progress?: {
    current: number;
    total: number;
    label?: string;
  };
  /** Optionaler Untertitel */
  subtitle?: string;
  /** Container-Style Override */
  style?: ViewStyle;
}

/**
 * TripPlannerHeader
 * 
 * Clean, Airbnb-style Header für den Trip Planner.
 * Zeigt Titel, Close-Button und optionalen Progress.
 */
export function TripPlannerHeader({
  title,
  onClose,
  progress,
  subtitle,
  style,
}: TripPlannerHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Close Button */}
      <TouchableOpacity
        onPress={onClose}
        style={styles.closeButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
        accessibilityLabel="Schließen"
        accessibilityRole="button"
      >
        <IconSymbol name="xmark" size={18} color={colors.text.primary} />
      </TouchableOpacity>

      {/* Title Section */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>

      {/* Progress Indicator */}
      {progress ? (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {progress.label || `${progress.current}/${progress.total}`}
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { width: `${(progress.current / progress.total) * 100}%` }
              ]} 
            />
          </View>
        </View>
      ) : (
        // Spacer für symmetrisches Layout
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  
  closeButton: {
    width: touchTargets.min,
    height: touchTargets.min,
    borderRadius: radii.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
    textAlign: 'center',
  },
  
  subtitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.regular,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  
  progressContainer: {
    width: touchTargets.min,
    alignItems: 'center',
  },
  
  progressText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  
  progressBar: {
    width: 32,
    height: 3,
    backgroundColor: colors.neutral[200],
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: radii.full,
  },
  
  spacer: {
    width: touchTargets.min,
  },
});

export default TripPlannerHeader;

