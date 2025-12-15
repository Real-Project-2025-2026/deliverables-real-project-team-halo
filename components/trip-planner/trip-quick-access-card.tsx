/**
 * TripQuickAccessCard
 * 
 * Elegante Karte für den Home-Screen zum schnellen Start einer Trip-Planung.
 * Airbnb-inspiriertes Design mit Search-Metapher.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, colors, typography, radii, shadows, touchTargets } from '@/constants/design-tokens';

interface TripQuickAccessCardProps {
  /** Optional: Aktuelle Adresse als Kontext */
  currentLocation?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * TripQuickAccessCard
 * 
 * Eine Karte die wie ein Such-Input aussieht, aber zum
 * Destination Search Screen navigiert.
 */
export function TripQuickAccessCard({ currentLocation }: TripQuickAccessCardProps) {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  };
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };
  
  const handlePress = () => {
    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Navigate to destination search
    router.push('/trip/destination-search');
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.container, animatedStyle]}
      accessibilityLabel="Trip planen"
      accessibilityRole="button"
    >
      {/* Search Icon */}
      <View style={styles.iconContainer}>
        <IconSymbol name="magnifyingglass" size={20} color={colors.text.primary} />
      </View>
      
      {/* Text Content */}
      <View style={styles.textContainer}>
        <Text style={styles.title}>Wohin geht's?</Text>
        {currentLocation ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            Von: {currentLocation}
          </Text>
        ) : (
          <Text style={styles.subtitle}>Starte deinen sicheren Trip</Text>
        )}
      </View>
      
      {/* Action Icon */}
      <View style={styles.actionContainer}>
        <View style={styles.actionButton}>
          <IconSymbol name="slider.horizontal.3" size={16} color={colors.text.primary} />
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    ...shadows.lg,
  },
  
  iconContainer: {
    width: touchTargets.standard,
    height: touchTargets.standard,
    borderRadius: radii.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  
  textContainer: {
    flex: 1,
  },
  
  title: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
    marginBottom: spacing.xs,
  },
  
  subtitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.regular,
    color: colors.text.tertiary,
  },
  
  actionContainer: {
    marginLeft: spacing.md,
  },
  
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TripQuickAccessCard;

