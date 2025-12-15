import React, { useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  interpolateColor,
} from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, colors, typography, radii, shadows, touchTargets } from '@/constants/design-tokens';

interface DestinationSearchFieldProps {
  /** Aktueller Suchwert */
  value: string;
  /** Callback bei Textänderung */
  onChangeText: (text: string) => void;
  /** Placeholder-Text */
  placeholder?: string;
  /** Label über dem Feld */
  label?: string;
  /** Ist das Feld fokussiert? */
  isFocused?: boolean;
  /** Callback beim Fokus */
  onFocus?: () => void;
  /** Callback beim Blur */
  onBlur?: () => void;
  /** Callback zum Löschen */
  onClear?: () => void;
  /** Autofokus beim Mount */
  autoFocus?: boolean;
  /** Container-Style Override */
  style?: ViewStyle;
}

const AnimatedView = Animated.createAnimatedComponent(View);

/**
 * DestinationSearchField
 * 
 * Elegantes Suchfeld für die Zieleingabe.
 * Mit animiertem Focus-State und Clear-Button.
 * Spellcheck und Autocorrect sind deaktiviert.
 */
export function DestinationSearchField({
  value,
  onChangeText,
  placeholder = 'Wohin?',
  label = 'Ziel',
  isFocused: externalFocused,
  onFocus,
  onBlur,
  onClear,
  autoFocus = false,
  style,
}: DestinationSearchFieldProps) {
  const inputRef = useRef<TextInput>(null);
  const focusAnim = useSharedValue(0);
  const [internalFocused, setInternalFocused] = React.useState(false);
  
  const isFocused = externalFocused ?? internalFocused;
  const hasValue = value.length > 0;
  
  // Update animation on focus change
  useEffect(() => {
    focusAnim.value = withSpring(isFocused ? 1 : 0, { 
      damping: 20, 
      stiffness: 300 
    });
  }, [isFocused, focusAnim]);
  
  // Animated container style
  const animatedContainerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      focusAnim.value,
      [0, 1],
      [colors.neutral[100], colors.neutral[0]]
    ),
    borderColor: interpolateColor(
      focusAnim.value,
      [0, 1],
      ['transparent', colors.primary[500]]
    ),
    ...shadows.card,
    shadowOpacity: focusAnim.value * 0.06,
  }));
  
  const handleFocus = () => {
    setInternalFocused(true);
    onFocus?.();
  };
  
  const handleBlur = () => {
    setInternalFocused(false);
    onBlur?.();
  };
  
  const handleClear = () => {
    onChangeText('');
    onClear?.();
    inputRef.current?.focus();
  };

  return (
    <View style={[styles.wrapper, style]}>
      <AnimatedView style={[styles.container, animatedContainerStyle]}>
        {/* Dot Indicator */}
        <View style={styles.dotContainer}>
          <View style={styles.dot} />
        </View>
        
        {/* Input Area */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.text.disabled}
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoFocus={autoFocus}
            returnKeyType="search"
            autoCapitalize="words"
            // Spellcheck deaktivieren
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            // iOS-spezifisch
            keyboardType="default"
            textContentType="none"
            // Accessibility
            accessibilityLabel={`${label} Suchfeld`}
            accessibilityHint="Gib dein Ziel ein"
          />
        </View>
        
        {/* Clear Button */}
        {hasValue && (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
            accessibilityLabel="Eingabe löschen"
          >
            <View style={styles.clearIconContainer}>
              <IconSymbol 
                name="xmark" 
                size={12} 
                color={colors.neutral[0]} 
              />
            </View>
          </TouchableOpacity>
        )}
      </AnimatedView>
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
    borderRadius: radii.xl,
    padding: spacing.lg,
    minHeight: touchTargets.large + spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
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
    backgroundColor: colors.trip.destination,
  },
  
  inputContainer: {
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
  
  input: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.text.primary,
    padding: 0,
    margin: 0,
    letterSpacing: typography.letterSpacing.tight,
    // Entferne native Styling
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none',
    }),
  },
  
  clearButton: {
    width: touchTargets.min,
    height: touchTargets.min,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  
  clearIconContainer: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    backgroundColor: colors.neutral[400],
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default DestinationSearchField;

