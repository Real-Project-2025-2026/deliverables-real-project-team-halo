import React from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, colors, typography, radii, shadows, touchTargets } from '@/constants/design-tokens';

interface PrimaryButtonProps {
  /** Button-Label */
  label: string;
  /** Callback beim Drücken */
  onPress: () => void;
  /** Ist der Button deaktiviert? */
  disabled?: boolean;
  /** Zeigt Loading-State */
  loading?: boolean;
  /** Optionales Icon (SF Symbol Name) */
  icon?: string;
  /** Icon-Position */
  iconPosition?: 'left' | 'right';
  /** Container-Style Override */
  style?: ViewStyle;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * PrimaryButton
 * 
 * Primärer CTA-Button mit Haptic Feedback.
 * Disabled-State mit reduzierter Opacity.
 * Loading-State mit ActivityIndicator.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'right',
  style,
}: PrimaryButtonProps) {
  const scale = useSharedValue(1);
  
  const isDisabled = disabled || loading;
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  const handlePressIn = () => {
    if (!isDisabled) {
      scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
    }
  };
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };
  
  const handlePress = () => {
    if (!isDisabled) {
      // Haptic Feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      onPress();
    }
  };

  return (
    <AnimatedTouchable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      activeOpacity={1}
      style={[
        styles.button,
        isDisabled && styles.buttonDisabled,
        animatedStyle,
        style,
      ]}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.text.inverse} />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <IconSymbol 
              name={icon as any} 
              size={20} 
              color={colors.text.inverse}
              style={styles.iconLeft}
            />
          )}
          
          <Text style={styles.label}>{label}</Text>
          
          {icon && iconPosition === 'right' && (
            <IconSymbol 
              name={icon as any} 
              size={20} 
              color={colors.text.inverse}
              style={styles.iconRight}
            />
          )}
        </>
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    borderRadius: 28, // Pill shape
    paddingVertical: spacing.lg + spacing.xs,
    paddingHorizontal: spacing['2xl'],
    minHeight: touchTargets.large,
    ...shadows.primary,
  },
  
  buttonDisabled: {
    opacity: 0.4,
    ...shadows.none,
  },
  
  label: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.text.inverse,
    letterSpacing: typography.letterSpacing.tight,
  },
  
  iconLeft: {
    marginRight: spacing.sm,
  },
  
  iconRight: {
    marginLeft: spacing.sm,
  },
});

export default PrimaryButton;

