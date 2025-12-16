import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  Pressable,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, colors, typography, radii, shadows, touchTargets, animation } from '@/constants/design-tokens';

type LocationFieldVariant = 'origin' | 'destination';
type LocationFieldState = 'idle' | 'loading' | 'selected' | 'error';

interface LocationFieldProps {
  /** Typ des Feldes (Start/Ziel) */
  variant: LocationFieldVariant;
  /** Label über dem Feld */
  label: string;
  /** Placeholder-Text wenn leer */
  placeholder: string;
  /** Ausgewählte Adresse */
  value?: string | null;
  /** Aktueller State */
  state?: LocationFieldState;
  /** Fehlermeldung */
  errorMessage?: string;
  /** Ist das Feld read-only? */
  readOnly?: boolean;
  /** Callback beim Klicken */
  onPress?: () => void;
  /** Callback zum Löschen der Auswahl */
  onClear?: () => void;
  /** Container-Style Override */
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * LocationField
 * 
 * Elegantes Eingabefeld für Start- und Zieladresse.
 * Zeigt verschiedene States: idle, loading, selected, error.
 */
export function LocationField({
  variant,
  label,
  placeholder,
  value,
  state = 'idle',
  errorMessage,
  readOnly = false,
  onPress,
  onClear,
  style,
}: LocationFieldProps) {
  const scale = useSharedValue(1);
  
  const isOrigin = variant === 'origin';
  const hasValue = Boolean(value && value.length > 0);
  const isLoading = state === 'loading';
  const isError = state === 'error';
  const showClear = hasValue && !readOnly && onClear;
  
  // Dot-Farbe basierend auf Variant
  const dotColor = isOrigin ? colors.trip.origin : colors.trip.destination;
  
  // Animated press feedback
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  const handlePressIn = () => {
    if (!readOnly) {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
    }
  };
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <View style={[styles.wrapper, style]}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={readOnly && !onPress}
        style={[
          styles.container,
          hasValue && styles.containerSelected,
          isError && styles.containerError,
          animatedStyle,
        ]}
        accessibilityLabel={`${label}: ${value || placeholder}`}
        accessibilityRole="button"
      >
        {/* Status Indicator Dot */}
        <View style={styles.dotContainer}>
          <View style={[styles.dot, { backgroundColor: dotColor }]}>
            {isOrigin && (
              <View style={[styles.dotInner, { borderColor: dotColor }]} />
            )}
          </View>
        </View>
        
        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.label}>{label}</Text>
          
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary[500]} />
              <Text style={styles.loadingText}>Ermittle Standort...</Text>
            </View>
          ) : hasValue ? (
            <Text style={styles.valueText} numberOfLines={2}>
              {value}
            </Text>
          ) : (
            <Text style={styles.placeholderText}>{placeholder}</Text>
          )}
        </View>
        
        {/* Action Button (Clear or Chevron) */}
        <View style={styles.actionContainer}>
          {showClear ? (
            <TouchableOpacity
              onPress={onClear}
              style={styles.clearButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
              accessibilityLabel="Auswahl löschen"
            >
              <IconSymbol 
                name="xmark.circle.fill" 
                size={22} 
                color={colors.neutral[400]} 
              />
            </TouchableOpacity>
          ) : !readOnly && (
            <IconSymbol 
              name="chevron.right" 
              size={16} 
              color={colors.neutral[400]} 
            />
          )}
        </View>
      </AnimatedPressable>
      
      {/* Error Message */}
      {isError && errorMessage && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    borderRadius: radii.xl,
    padding: spacing.lg,
    minHeight: touchTargets.large + spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  
  containerSelected: {
    backgroundColor: colors.neutral[0],
    ...shadows.card,
  },
  
  containerError: {
    borderColor: colors.error.main,
    backgroundColor: colors.error.light,
  },
  
  dotContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  
  dot: {
    width: 14,
    height: 14,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  dotInner: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
  },
  
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.text.tertiary,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  
  valueText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.text.primary,
    lineHeight: typography.size.base * typography.lineHeight.normal,
    letterSpacing: typography.letterSpacing.tight,
  },
  
  placeholderText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.regular,
    color: colors.text.disabled,
    letterSpacing: typography.letterSpacing.tight,
  },
  
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  
  loadingText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.regular,
    color: colors.text.tertiary,
  },
  
  actionContainer: {
    width: touchTargets.min,
    height: touchTargets.min,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  
  clearButton: {
    width: touchTargets.min,
    height: touchTargets.min,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  errorText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.regular,
    color: colors.error.main,
    marginTop: spacing.sm,
    marginLeft: spacing.lg,
  },
});

export default LocationField;

