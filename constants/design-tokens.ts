/**
 * Design Tokens - Centralized design system values
 * Inspired by Airbnb's design principles
 */

// ============================================================================
// SPACING (8px base grid)
// ============================================================================
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

// ============================================================================
// COLORS
// ============================================================================
export const colors = {
  // Neutral scale (white to black)
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0A0A0A',
  },

  // Primary (brand blue)
  primary: {
    50: '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8',
    500: '#5170FF', // Main brand color
    600: '#4F46E5',
    700: '#4338CA',
    800: '#3730A3',
    900: '#312E81',
  },

  // Success (green)
  success: {
    light: '#DCFCE7',
    main: '#22C55E',
    dark: '#16A34A',
  },

  // Warning (amber/orange)
  warning: {
    light: '#FEF3C7',
    main: '#F59E0B',
    dark: '#D97706',
  },

  // Error (red)
  error: {
    light: '#FEE2E2',
    main: '#EF4444',
    dark: '#DC2626',
  },

  // Text colors
  text: {
    primary: '#171717',
    secondary: '#525252',
    tertiary: '#A3A3A3',
    inverse: '#FFFFFF',
  },

  // Background colors
  background: {
    primary: '#FFFFFF',
    secondary: '#FAFAFA',
    tertiary: '#F5F5F5',
  },

  // Border colors
  border: {
    light: '#F5F5F5',
    default: '#E5E5E5',
    strong: '#D4D4D4',
  },

  // Trip-specific colors
  trip: {
    origin: '#22C55E',      // Green for start
    destination: '#5170FF', // Blue for destination
    route: '#818CF8',       // Purple for route line
  },
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================
export const typography = {
  // Font sizes
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },

  // Font weights
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Letter spacing
  letterSpacing: {
    tighter: -0.5,
    tight: -0.25,
    normal: 0,
    wide: 0.25,
    wider: 0.5,
  },
} as const;

// ============================================================================
// BORDER RADIUS
// ============================================================================
export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  '4xl': 32,
  full: 9999,
} as const;

// ============================================================================
// SHADOWS
// ============================================================================
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  '2xl': {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

// ============================================================================
// ANIMATION DURATIONS
// ============================================================================
export const animation = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

// ============================================================================
// TOUCH TARGETS (Accessibility - minimum 44px)
// ============================================================================
export const touchTargets = {
  min: 44,
  standard: 44,
  comfortable: 48,
  large: 56,
} as const;

// ============================================================================
// COMMON COMPOSITES
// ============================================================================
export const composites = {
  // Card styles
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  cardLarge: {
    backgroundColor: colors.neutral[0],
    borderRadius: radii['2xl'],
    padding: spacing.xl,
    ...shadows.lg,
  },

  // Input styles
  input: {
    backgroundColor: colors.neutral[50],
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.base,
  },

  // Button base
  buttonPrimary: {
    backgroundColor: colors.primary[500],
    borderRadius: radii.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    ...shadows.md,
  },
  buttonSecondary: {
    backgroundColor: colors.neutral[100],
    borderRadius: radii.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
} as const;

