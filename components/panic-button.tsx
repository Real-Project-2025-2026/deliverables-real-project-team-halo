import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { hapticFeedback } from '@/services/haptic-service';

const ACTIVATION_THRESHOLD = 3000; // 3 Sekunden
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface PanicButtonRef {
  getPosition: () => { x: number; y: number };
}

interface PanicButtonProps {
  size: number;
  onActivate: () => void;
  onRelease: () => void;
  onDrag?: (x: number, y: number) => void;
  disabled?: boolean;
  isOverlayActive?: boolean;
}

export const PanicButton = forwardRef<PanicButtonRef, PanicButtonProps>(({
  size,
  onActivate,
  onRelease,
  onDrag,
  disabled,
  isOverlayActive,
}, ref) => {
  const scale = useSharedValue(1);
  const progress = useSharedValue(0);
  const pulseOpacity = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const isPressing = useRef(false);
  const isActivated = useRef(false);
  const pressStartTime = useRef<number | null>(null);
  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const hapticTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Refs für Callbacks damit PanResponder immer aktuelle Werte hat
  const onDragRef = useRef(onDrag);
  const onReleaseRef = useRef(onRelease);
  const onActivateRef = useRef(onActivate);
  const disabledRef = useRef(disabled);
  
  // Refs aktualisieren wenn Props sich ändern
  useEffect(() => {
    onDragRef.current = onDrag;
    onReleaseRef.current = onRelease;
    onActivateRef.current = onActivate;
    disabledRef.current = disabled;
  }, [onDrag, onRelease, onActivate, disabled]);

  useImperativeHandle(ref, () => ({
    getPosition: () => ({
      x: translateX.value,
      y: translateY.value,
    }),
  }));

  const clearTimers = () => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    if (hapticTimer.current) {
      clearInterval(hapticTimer.current);
      hapticTimer.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  // Reset position when overlay closes
  useEffect(() => {
    if (!isOverlayActive) {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      isActivated.current = false;
    }
  }, [isOverlayActive]);


  const handleActivation = () => {
    isActivated.current = true;
    hapticFeedback('heavy');
    onActivateRef.current();
  };

  const startPress = () => {
    if (disabledRef.current) return;
    
    isPressing.current = true;
    pressStartTime.current = Date.now();
    
    // Haptic feedback beim Start
    hapticFeedback('light');
    
    // Button Scale Animation
    scale.value = withSpring(0.92, { damping: 15, stiffness: 200 });
    
    // Progress Animation
    progress.value = withTiming(1, {
      duration: ACTIVATION_THRESHOLD,
      easing: Easing.linear,
    });
    
    // Pulse Animation starten
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 500 }),
        withTiming(0.2, { duration: 500 })
      ),
      -1,
      true
    );
    
    // Timer für Progress und Haptic Feedback
    let tickCount = 0;
    progressTimer.current = setInterval(() => {
      if (!isPressing.current) {
        clearTimers();
        return;
      }
      
      const elapsed = Date.now() - (pressStartTime.current || Date.now());
      tickCount++;
      
      // Haptic tick jede Sekunde
      if (tickCount % 10 === 0) {
        hapticFeedback('medium');
      }
      
      // Aktivierung nach 3 Sekunden
      if (elapsed >= ACTIVATION_THRESHOLD && !isActivated.current) {
        clearTimers();
        runOnJS(handleActivation)();
      }
    }, 100);
  };

  const endPress = () => {
    const wasActivated = isActivated.current;
    isPressing.current = false;
    pressStartTime.current = null;
    clearTimers();
    
    // Animationen zurücksetzen
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
    progress.value = withTiming(0, { duration: 200 });
    cancelAnimation(pulseOpacity);
    pulseOpacity.value = withTiming(0, { duration: 200 });
    
    if (wasActivated) {
      // Einfach melden dass losgelassen wurde - CustomTabBar entscheidet
      onReleaseRef.current();
    }
    
    // Position zurücksetzen
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startPress();
      },
      onPanResponderMove: (_, gestureState) => {
        // Nur bewegen wenn aktiviert (nach 3 Sekunden)
        if (isActivated.current) {
          translateX.value = gestureState.dx;
          translateY.value = gestureState.dy;
          
          // Verwende Ref für aktuellen Callback
          if (onDragRef.current) {
            onDragRef.current(gestureState.dx, gestureState.dy);
          }
        }
      },
      onPanResponderRelease: () => {
        endPress();
      },
      onPanResponderTerminate: () => {
        endPress();
      },
    })
  ).current;

  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const animatedPulseStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseOpacity.value,
      transform: [
        { scale: 1 + pulseOpacity.value * 0.15 },
      ],
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Pulse Ring */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: size + 20,
            height: size + 20,
            borderRadius: (size + 20) / 2,
          },
          animatedPulseStyle,
        ]}
      />
      
      {/* Main Button */}
      <Animated.View
        style={[
          styles.button,
          { width: size, height: size, borderRadius: size / 2 },
          animatedButtonStyle,
          isOverlayActive && styles.buttonElevated,
        ]}
        {...panResponder.panHandlers}
      >
        <LinearGradient
          colors={['#6B8AFF', '#5170FF', '#3D5AF1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { borderRadius: size / 2 }]}
        >
          <IconSymbol
            name="sos"
            size={size * 0.4}
            color="#fff"
          />
        </LinearGradient>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 1000,
  },
  buttonElevated: {
    zIndex: 10000,
    elevation: 100,
  },
  gradient: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    backgroundColor: '#5170FF',
  },
});
