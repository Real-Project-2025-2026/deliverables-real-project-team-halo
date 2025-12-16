import React, { useState, useCallback, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Dimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanicButton } from './panic-button';
import { PanicOverlay, CANCEL_ZONE_SIZE, CANCEL_ZONE_CENTER } from './panic-overlay';
import * as Haptics from 'expo-haptics';
import { hapticFeedback, vibrateEmergency } from '@/services/haptic-service';
import { triggerPanicAlarm, logPanicEvent } from '@/services/panic-service';
import { startAlarm, stopAlarm } from '@/services/alarm-service';
import * as Location from 'expo-location';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 60;
const PANIC_BUTTON_SIZE = 70;
const PANIC_BUTTON_OFFSET = 25; // How much it sticks above the tab bar

// Tabs die angezeigt werden sollen (in der richtigen Reihenfolge)
const VISIBLE_TABS = ['index', 'explore', 'guardian-trips', 'settings'];

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [panicOverlayVisible, setPanicOverlayVisible] = useState(false);
  const [isInCancelZoneState, setIsInCancelZoneState] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerComplete, setTriggerComplete] = useState(false);
  
  // Ref für sofortigen Zugriff auf den aktuellen Wert (State ist asynchron!)
  const isInCancelZoneRef = useRef(false);
  const lastHapticDistance = useRef<number>(Infinity);
  const hapticThrottleRef = useRef<number>(0);

  // Get visible routes in the correct order
  const visibleRoutes = VISIBLE_TABS
    .map(tabName => state.routes.find(route => route.name === tabName))
    .filter((route): route is typeof state.routes[0] => route !== undefined);

  // Panic Button kommt nach dem 2. Tab (zwischen SafeTogether und Trips)
  const panicInsertIndex = 2;

  const handlePanicActivate = () => {
    setPanicOverlayVisible(true);
    setIsInCancelZoneState(false);
    isInCancelZoneRef.current = false;
    lastHapticDistance.current = Infinity;
    hapticThrottleRef.current = 0;
    setIsTriggering(false);
    setTriggerComplete(false);
  };

  const handlePanicRelease = async () => {
    // Verwende den Ref für sofortigen Zugriff (State kann verzögert sein)
    const inCancelZone = isInCancelZoneRef.current;
    
    if (inCancelZone) {
      // Abgebrochen - in Cancel Zone losgelassen
      hapticFeedback('success');
      logPanicEvent('cancelled');
      stopAlarm(); // Falls Alarm irgendwie gestartet wurde
      setPanicOverlayVisible(false);
      setIsInCancelZoneState(false);
      isInCancelZoneRef.current = false;
    } else {
      // Alarm auslösen - außerhalb Cancel Zone losgelassen
      if (isTriggering) return;
      
      setIsTriggering(true);
      vibrateEmergency();
      
      // Sirenen-Alarm starten!
      startAlarm();
      
      try {
        // Get current location
        let location: { latitude: number; longitude: number } | undefined;
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            const currentLocation = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            location = {
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
            };
          }
        } catch (locError) {
          console.error('Error getting location for panic:', locError);
        }
        
        // Trigger the alarm (notify contacts)
        await triggerPanicAlarm(location);
        
        setTriggerComplete(true);
        
        // Sirene läuft weiter - wird erst nach 30 Sekunden oder manuell gestoppt
        // Wait a moment then close overlay (but alarm continues)
        setTimeout(async () => {
          setPanicOverlayVisible(false);
          setIsInCancelZoneState(false);
          isInCancelZoneRef.current = false;
          setIsTriggering(false);
          setTriggerComplete(false);
          
          // Alarm nach weiteren 30 Sekunden automatisch stoppen
          setTimeout(() => {
            stopAlarm();
          }, 30000);
        }, 2500);
        
      } catch (error) {
        console.error('Error triggering panic alarm:', error);
        stopAlarm();
        setIsTriggering(false);
        setPanicOverlayVisible(false);
      }
    }
  };

  const handlePanicDrag = useCallback((dx: number, dy: number) => {
    // Berechne Distanz zur Cancel-Zone (Bildschirm-Mitte)
    const targetY = -(SCREEN_HEIGHT / 2 - 150); // Wie weit nach oben für Cancel
    const distanceToTarget = Math.abs(dy - targetY) + Math.abs(dx) * 0.5;
    
    // Vereinfachte Berechnung für Cancel Zone
    const verticalThreshold = -(SCREEN_HEIGHT / 2 - 150);
    const horizontalThreshold = 100;
    const inZone = dy < verticalThreshold && Math.abs(dx) < horizontalThreshold;
    
    // IMMER den Ref aktualisieren für sofortigen Zugriff
    isInCancelZoneRef.current = inZone;
    
    // Haptic Feedback basierend auf Distanz - je näher, desto mehr Haptics
    const now = Date.now();
    if (now - hapticThrottleRef.current > 100) { // Max alle 100ms
      // Berechne wie nah wir sind (0-1, 1 = in der Zone)
      const maxDistance = 400; // Maximale Distanz für Haptics
      const proximity = Math.max(0, 1 - distanceToTarget / maxDistance);
      
      if (proximity > 0.3) {
        // Je näher, desto stärker
        if (proximity > 0.9 || inZone) {
          hapticFeedback('heavy');
          hapticThrottleRef.current = now;
        } else if (proximity > 0.7) {
          hapticFeedback('medium');
          hapticThrottleRef.current = now;
        } else if (proximity > 0.5 && distanceToTarget < lastHapticDistance.current - 30) {
          hapticFeedback('light');
          hapticThrottleRef.current = now;
          lastHapticDistance.current = distanceToTarget;
        }
      }
    }
    
    // State nur aktualisieren wenn sich der Wert ändert (für UI)
    if (inZone !== isInCancelZoneState) {
      setIsInCancelZoneState(inZone);
    }
  }, [isInCancelZoneState]);

  const renderTabButton = (route: typeof state.routes[0]) => {
    const { options } = descriptors[route.key];
    const label =
      options.tabBarLabel !== undefined
        ? options.tabBarLabel
        : options.title !== undefined
        ? options.title
        : route.name;

    const isFocused = state.index === state.routes.indexOf(route);

    const onPress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    const onLongPress = () => {
      navigation.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    };

    const color = isFocused ? '#5170FF' : '#999';

    return (
      <TouchableOpacity
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        testID={options.tabBarTestID}
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.tabButton}
      >
        {options.tabBarIcon && options.tabBarIcon({ focused: isFocused, color, size: 24 })}
        <Text
          style={[styles.tabLabel, { color }]}
          numberOfLines={1}
        >
          {typeof label === 'string' ? label : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  // Tabs in zwei Gruppen aufteilen: links und rechts vom Panic Button
  const leftTabs = visibleRoutes.slice(0, panicInsertIndex);
  const rightTabs = visibleRoutes.slice(panicInsertIndex);

  return (
    <View style={styles.rootContainer}>
      {/* Panic Overlay (unter dem Button) */}
      <PanicOverlay
        visible={panicOverlayVisible}
        isInCancelZone={isInCancelZoneState}
        isTriggering={isTriggering}
        triggerComplete={triggerComplete}
      />

      {/* Tab Bar */}
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        {/* Tab Items */}
        <View style={styles.tabContainer}>
          {/* Linke Tabs */}
          {leftTabs.map((route) => renderTabButton(route))}
          
          {/* Spacer für Panic Button */}
          <View style={styles.panicSpacer} />
          
          {/* Rechte Tabs */}
          {rightTabs.map((route) => renderTabButton(route))}
        </View>

        {/* Erhöhter Panic Button - immer über dem Overlay */}
        <View style={[
          styles.panicButtonContainer,
          panicOverlayVisible && styles.panicButtonContainerActive,
        ]}>
          <PanicButton
            size={PANIC_BUTTON_SIZE}
            onActivate={handlePanicActivate}
            onRelease={handlePanicRelease}
            onDrag={handlePanicDrag}
            disabled={isTriggering}
            isOverlayActive={panicOverlayVisible}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    position: 'relative',
  },
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    position: 'relative',
    zIndex: 200,
  },
  tabContainer: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    maxWidth: 80,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'center',
  },
  panicSpacer: {
    width: PANIC_BUTTON_SIZE,
  },
  panicButtonContainer: {
    position: 'absolute',
    top: -PANIC_BUTTON_OFFSET,
    left: '50%',
    marginLeft: -(PANIC_BUTTON_SIZE / 2),
    zIndex: 300,
    // Shadow für iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    // Elevation für Android
    elevation: 8,
  },
  panicButtonContainerActive: {
    zIndex: 10000,
    elevation: 1000,
  },
});
