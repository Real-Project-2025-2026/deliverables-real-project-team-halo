import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  FadeIn,
} from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, colors, typography, radii, touchTargets } from '@/constants/design-tokens';

interface SuggestionItemProps {
  /** Haupttitel (z.B. "Edeka Markt") */
  title: string;
  /** Adress-Untertitel */
  subtitle: string;
  /** Optionale Distanz-Anzeige */
  distance?: string;
  /** Icon-Name für das Location-Icon */
  icon?: string;
  /** Callback beim Auswählen */
  onPress: () => void;
  /** Index für gestaffelte Animation */
  index?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * SuggestionItem
 * 
 * Einzelner Vorschlag in der Suchliste.
 * Modern mit Icon, Titel, Subtitle und optionaler Distanz.
 */
export function SuggestionItem({
  title,
  subtitle,
  distance,
  icon = 'mappin',
  onPress,
  index = 0,
}: SuggestionItemProps) {
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(0);
  
  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: `rgba(0, 0, 0, ${bgOpacity.value})`,
  }));
  
  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
    bgOpacity.value = withSpring(0.03, { damping: 15, stiffness: 400 });
  };
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    bgOpacity.value = withSpring(0, { damping: 15, stiffness: 400 });
  };

  return (
    <Animated.View 
      entering={FadeIn.delay(index * 30).duration(200)}
    >
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.container, animatedContainerStyle]}
        accessibilityLabel={`${title}, ${subtitle}`}
        accessibilityRole="button"
      >
        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <IconSymbol 
              name={icon as any} 
              size={16} 
              color={colors.primary[500]} 
            />
          </View>
        </View>
        
        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        
        {/* Distance (optional) */}
        {distance && (
          <View style={styles.distanceContainer}>
            <Text style={styles.distanceText}>{distance}</Text>
          </View>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
}

/**
 * SuggestionItemSkeleton
 * 
 * Skeleton-Placeholder während des Ladens.
 */
export function SuggestionItemSkeleton({ index = 0 }: { index?: number }) {
  return (
    <Animated.View 
      entering={FadeIn.delay(index * 50).duration(150)}
      style={styles.skeletonContainer}
    >
      {/* Icon Skeleton */}
      <View style={styles.iconContainer}>
        <View style={styles.skeletonIconCircle} />
      </View>
      
      {/* Text Skeleton */}
      <View style={styles.textContainer}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonSubtitle} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.sm,
    borderRadius: radii.lg,
    minHeight: touchTargets.large,
  },
  
  iconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: spacing.sm,
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
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  },
  
  distanceContainer: {
    paddingLeft: spacing.md,
    alignItems: 'flex-end',
  },
  
  distanceText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.tertiary,
  },
  
  // Skeleton Styles
  skeletonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.sm,
    minHeight: touchTargets.large,
  },
  
  skeletonIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.neutral[150],
  },
  
  skeletonTitle: {
    width: '60%',
    height: 14,
    borderRadius: radii.sm,
    backgroundColor: colors.neutral[150],
    marginBottom: spacing.sm,
  },
  
  skeletonSubtitle: {
    width: '85%',
    height: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.neutral[100],
  },
});

export default SuggestionItem;

