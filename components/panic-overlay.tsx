import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  interpolateColor,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { hapticFeedback } from '@/services/haptic-service';
import { logPanicEvent } from '@/services/panic-service';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
export const CANCEL_ZONE_SIZE = 120;
export const CANCEL_ZONE_CENTER = {
  x: SCREEN_WIDTH / 2,
  y: SCREEN_HEIGHT / 2,
};

interface PanicOverlayProps {
  visible: boolean;
  isInCancelZone: boolean;
  isTriggering: boolean;
  triggerComplete: boolean;
  /** If true, overlay covers full screen (for use outside tab bar) */
  fullscreen?: boolean;
}

export function PanicOverlay({ 
  visible, 
  isInCancelZone,
  isTriggering,
  triggerComplete,
  fullscreen = false,
}: PanicOverlayProps) {
  // Animation values
  const opacity = useSharedValue(0);
  const pulseIntensity = useSharedValue(0);
  const cancelZoneScale = useSharedValue(1);
  const cancelZoneOpacity = useSharedValue(0.5);
  const flashOpacity = useSharedValue(0);
  
  const hapticInterval = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      // Fade in
      opacity.value = withTiming(1, { duration: 300 });
      
      // Start pulse animation
      pulseIntensity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.5, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      
      // Show cancel zone
      cancelZoneOpacity.value = withTiming(0.8, { duration: 500 });
      
      // Haptic pulse every 2 seconds
      hapticInterval.current = setInterval(() => {
        hapticFeedback('medium');
      }, 2000);
      
      // Log activation
      logPanicEvent('activated');
    } else {
      // Fade out
      opacity.value = withTiming(0, { duration: 200 });
      cancelAnimation(pulseIntensity);
      
      // Clear haptic interval
      if (hapticInterval.current) {
        clearInterval(hapticInterval.current);
        hapticInterval.current = null;
      }
    }
    
    return () => {
      if (hapticInterval.current) {
        clearInterval(hapticInterval.current);
        hapticInterval.current = null;
      }
    };
  }, [visible]);

  // Flash when triggering
  useEffect(() => {
    if (isTriggering && !triggerComplete) {
      flashOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 200 })
      );
    }
  }, [isTriggering]);

  // Cancel zone highlight when button is near
  useEffect(() => {
    if (isInCancelZone) {
      cancelZoneScale.value = withTiming(1.15, { duration: 150 });
      cancelZoneOpacity.value = withTiming(1, { duration: 150 });
    } else {
      cancelZoneScale.value = withTiming(1, { duration: 150 });
      cancelZoneOpacity.value = withTiming(0.6, { duration: 150 });
    }
  }, [isInCancelZone]);

  const animatedOverlayStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      pulseIntensity.value,
      [0.5, 1],
      ['rgba(220, 38, 38, 0.85)', 'rgba(185, 28, 28, 0.95)']
    );
    
    return {
      opacity: opacity.value,
      backgroundColor,
    };
  });

  const animatedCancelZoneStyle = useAnimatedStyle(() => {
    return {
      opacity: cancelZoneOpacity.value,
      transform: [{ scale: cancelZoneScale.value }],
    };
  });

  const animatedFlashStyle = useAnimatedStyle(() => {
    return {
      opacity: flashOpacity.value,
    };
  });

  if (!visible) return null;

  return (
    <Animated.View 
      style={[
        styles.overlay, 
        fullscreen && styles.overlayFullscreen,
        animatedOverlayStyle
      ]} 
      pointerEvents="box-none"
    >
      {/* Flash effect */}
      <Animated.View style={[styles.flash, animatedFlashStyle]} pointerEvents="none" />
      
      {/* Header Text */}
      <View style={styles.header} pointerEvents="none">
        <IconSymbol name="exclamationmark.triangle.fill" size={48} color="#fff" />
        <Text style={styles.title}>PANIC MODE</Text>
        <Text style={styles.subtitle}>
          {isTriggering
            ? triggerComplete
              ? 'Hilfe ist unterwegs!'
              : 'Alarm wird gesendet...'
            : 'Ziehe in die Mitte zum Abbrechen\noder loslassen für Alarm'}
        </Text>
      </View>

      {/* Cancel Zone in der Mitte */}
      {!isTriggering && (
        <Animated.View 
          style={[
            styles.cancelZone, 
            fullscreen && styles.cancelZoneFullscreen,
            animatedCancelZoneStyle
          ]} 
          pointerEvents="none"
        >
          <View style={styles.cancelZoneInner}>
            <IconSymbol name="xmark" size={40} color="#fff" />
            <Text style={styles.cancelText}>Abbrechen</Text>
          </View>
        </Animated.View>
      )}

      {/* Status nach Trigger */}
      {triggerComplete && (
        <View style={[styles.completeContainer, fullscreen && styles.completeContainerFullscreen]} pointerEvents="none">
          <View style={styles.completeIcon}>
            <IconSymbol name="checkmark.shield.fill" size={64} color="#fff" />
          </View>
          <Text style={styles.completeText}>
            Deine Notfallkontakte wurden benachrichtigt
          </Text>
        </View>
      )}

      {/* Footer Hinweis */}
      {!isTriggering && (
        <View style={[styles.footer, fullscreen && styles.footerFullscreen]} pointerEvents="none">
          <Text style={styles.footerText}>
            Halte den Button weiter gedrückt
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: -SCREEN_HEIGHT,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT + 150, // Extra für Tab-Bar und Safe Area
    justifyContent: 'flex-start',
    alignItems: 'center',
    zIndex: 100,
  },
  overlayFullscreen: {
    top: 0,
    bottom: 0,
    height: SCREEN_HEIGHT,
    zIndex: 10000,
    elevation: 10000,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    zIndex: 101,
  },
  header: {
    marginTop: 100,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    marginTop: 16,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 26,
  },
  cancelZone: {
    position: 'absolute',
    top: SCREEN_HEIGHT / 2 - CANCEL_ZONE_SIZE / 2,
    left: SCREEN_WIDTH / 2 - CANCEL_ZONE_SIZE / 2,
    width: CANCEL_ZONE_SIZE,
    height: CANCEL_ZONE_SIZE,
    borderRadius: CANCEL_ZONE_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelZoneFullscreen: {
    top: (SCREEN_HEIGHT / 2) - CANCEL_ZONE_SIZE / 2 - 50,
  },
  cancelZoneInner: {
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  completeContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT / 2 - 80,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  completeContainerFullscreen: {
    top: (SCREEN_HEIGHT / 2) - 130,
  },
  completeIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  completeText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 200, // Über der Tab-Bar
    alignItems: 'center',
  },
  footerFullscreen: {
    bottom: 120,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
});
