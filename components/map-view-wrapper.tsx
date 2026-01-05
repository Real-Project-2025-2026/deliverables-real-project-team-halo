import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image as ExpoImage } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

interface GuardianMarker {
  id: string;
  latitude: number;
  longitude: number;
  avatarUrl: string | null;
  username: string | null;
  fullName: string | null;
}

interface MapViewWrapperProps {
  userLocation?: { latitude: number; longitude: number };
  userAvatar?: string | null;
  userName?: string | null;
  origin?: { latitude: number; longitude: number };
  destination?: { latitude: number; longitude: number };
  routePoints?: Array<{ latitude: number; longitude: number }>;
  plannedRoute?: Array<{ latitude: number; longitude: number }>;
  guardians?: GuardianMarker[];
  onLocationButtonPress?: () => void;
  onMapPress?: (event: any) => void;
}

export function MapViewWrapper({
  userLocation,
  userAvatar,
  userName,
  origin,
  destination,
  routePoints = [],
  plannedRoute = [],
  guardians = [],
  onLocationButtonPress,
  onMapPress,
}: MapViewWrapperProps) {
  const mapRef = useRef<MapView>(null);
  const isUserInteractingRef = useRef(false);
  const lastManualInteractionRef = useRef(Date.now());
  const hasInitialZoomRef = useRef(false);

  // Defensive check for valid coordinates
  const isValidCoordinate = (coord?: { latitude: number; longitude: number }): boolean => {
    return !!(
      coord &&
      typeof coord.latitude === 'number' &&
      typeof coord.longitude === 'number' &&
      !isNaN(coord.latitude) &&
      !isNaN(coord.longitude) &&
      coord.latitude !== 0 &&
      coord.longitude !== 0
    );
  };

  // Only auto-focus on initial load, not during user interaction
  useEffect(() => {
    if (
      !hasInitialZoomRef.current &&
      isValidCoordinate(userLocation) &&
      mapRef.current
    ) {
      hasInitialZoomRef.current = true;
      mapRef.current.animateToRegion(
        {
          latitude: userLocation!.latitude,
          longitude: userLocation!.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  }, [userLocation?.latitude, userLocation?.longitude]);

  // Only auto-fit route on initial load, not during user interaction
  useEffect(() => {
    if (
      !hasInitialZoomRef.current &&
      routePoints &&
      routePoints.length > 0 &&
      mapRef.current &&
      !isUserInteractingRef.current
    ) {
      const coordinates = routePoints
        .filter((point) => isValidCoordinate(point))
        .map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
        }));

      if (isValidCoordinate(userLocation)) {
        coordinates.push({
          latitude: userLocation!.latitude,
          longitude: userLocation!.longitude,
        });
      }

      if (isValidCoordinate(origin)) {
        coordinates.push({
          latitude: origin!.latitude,
          longitude: origin!.longitude,
        });
      }

      if (isValidCoordinate(destination)) {
        coordinates.push({
          latitude: destination!.latitude,
          longitude: destination!.longitude,
        });
      }

      // Fit map to show all route points only if user hasn't interacted recently
      const timeSinceInteraction = Date.now() - lastManualInteractionRef.current;
      if (coordinates.length > 0 && timeSinceInteraction > 2000) {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: {
            top: 100,
            right: 50,
            bottom: 300,
            left: 50,
          },
          animated: true,
        });
      }
    }
  }, [routePoints?.length, userLocation, destination]);

  // Handle location button press
  const handleLocationPress = () => {
    if (onLocationButtonPress) {
      onLocationButtonPress();
    }
    
    // Reset user interaction flags - user explicitly wants to center on location
    isUserInteractingRef.current = false;
    lastManualInteractionRef.current = Date.now();
    
    // Move camera to user location
    if (isValidCoordinate(userLocation) && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation!.latitude,
          longitude: userLocation!.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  };

  // Initial region
  const initialRegion = isValidCoordinate(userLocation)
    ? {
        latitude: userLocation!.latitude,
        longitude: userLocation!.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude: 52.5200,
        longitude: 13.4050,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        mapType="standard"
        rotateEnabled={true}
        pitchEnabled={true}
        followsUserLocation={false}
        userLocationPriority="high"
        userLocationUpdateInterval={5000}
        userLocationFastestInterval={2000}
        onPanDrag={() => {
          // User is actively panning - disable auto-follow
          isUserInteractingRef.current = true;
          lastManualInteractionRef.current = Date.now();
        }}
        onRegionChangeComplete={() => {
          // User has finished panning/zooming - reset after delay
          lastManualInteractionRef.current = Date.now();
          setTimeout(() => {
            // Only reset if no interaction for 3 seconds
            const timeSinceInteraction = Date.now() - lastManualInteractionRef.current;
            if (timeSinceInteraction >= 3000) {
              isUserInteractingRef.current = false;
            }
          }, 3000);
        }}
        onUserLocationChange={(e) => {
          if (e.nativeEvent.coordinate) {
            console.log('User location updated:', e.nativeEvent.coordinate);
            // Only rotate map if user is not actively interacting
            const timeSinceInteraction = Date.now() - lastManualInteractionRef.current;
            if (
              !isUserInteractingRef.current &&
              timeSinceInteraction > 2000 &&
              e.nativeEvent.coordinate.heading !== undefined &&
              e.nativeEvent.coordinate.heading >= 0 &&
              mapRef.current
            ) {
              // Only update heading/rotation, not center position
              mapRef.current.animateCamera(
                {
                  center: {
                    latitude: e.nativeEvent.coordinate.latitude,
                    longitude: e.nativeEvent.coordinate.longitude,
                  },
                  heading: e.nativeEvent.coordinate.heading,
                  pitch: 0,
                  altitude: 0,
                  zoom: 15,
                },
                { duration: 300 }
              );
            }
          }
        }}
        onPress={onMapPress}>
        {/* Planned Route (between origin and destination) */}
        {plannedRoute && plannedRoute.length > 1 && (
          <>
            {/* Shadow layer for planned route */}
            <Polyline
              coordinates={plannedRoute.map((point) => ({
                latitude: point.latitude,
                longitude: point.longitude,
              }))}
              strokeColor="rgba(81, 112, 255, 0.2)"
              strokeWidth={12}
              lineCap="round"
              lineJoin="round"
            />
            {/* Main planned route line */}
            <Polyline
              coordinates={plannedRoute.map((point) => ({
                latitude: point.latitude,
                longitude: point.longitude,
              }))}
              strokeColor="#5170FF"
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
            />
          </>
        )}

        {/* Actual Route (tracked route points) */}
        {routePoints && routePoints.length > 1 && (
          <>
            {/* Shadow layer */}
            <Polyline
              coordinates={routePoints.map((point) => ({
                latitude: point.latitude,
                longitude: point.longitude,
              }))}
              strokeColor="rgba(81, 112, 255, 0.2)"
              strokeWidth={12}
              lineCap="round"
              lineJoin="round"
            />
            {/* Main route line */}
            <Polyline
              coordinates={routePoints.map((point) => ({
                latitude: point.latitude,
                longitude: point.longitude,
              }))}
              strokeColor="#5170FF"
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
            />
          </>
        )}

        {/* Origin marker (user avatar) */}
        {isValidCoordinate(origin) && (
          <Marker
            coordinate={{
              latitude: origin!.latitude,
              longitude: origin!.longitude,
            }}
            title="Start"
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={999}>
            <View style={styles.userLocationMarker}>
              {/* Pulsing circle effect (background) */}
              <View style={styles.userLocationPulse} />
              {/* Avatar */}
              {userAvatar ? (
                <ExpoImage
                  source={{ uri: userAvatar }}
                  style={styles.userAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
                  <IconSymbol name="person.fill" size={24} color="#fff" />
                </View>
              )}
            </View>
          </Marker>
        )}

        {/* Start marker (first route point if no origin specified) */}
        {!origin && routePoints && routePoints.length > 0 && isValidCoordinate(routePoints[0]) && (
          <Marker
            coordinate={{
              latitude: routePoints[0].latitude,
              longitude: routePoints[0].longitude,
            }}
            title="Start"
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={999}>
            <View style={styles.userLocationMarker}>
              <View style={styles.userLocationPulse} />
              {userAvatar ? (
                <ExpoImage
                  source={{ uri: userAvatar }}
                  style={styles.userAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
                  <IconSymbol name="person.fill" size={24} color="#fff" />
                </View>
              )}
            </View>
          </Marker>
        )}

        {/* Destination marker (pin) */}
        {isValidCoordinate(destination) && (
          <Marker
            coordinate={{
              latitude: destination!.latitude,
              longitude: destination!.longitude,
            }}
            title="Ziel"
            pinColor="#FF3B30"
          />
        )}

        {/* Guardian markers with avatars */}
        {guardians.map((guardian) => (
          <Marker
            key={guardian.id}
            coordinate={{
              latitude: guardian.latitude,
              longitude: guardian.longitude,
            }}
            title={guardian.fullName || guardian.username || 'Guardian'}>
            <View style={styles.guardianMarker}>
              {guardian.avatarUrl ? (
                <ExpoImage
                  source={{ uri: guardian.avatarUrl }}
                  style={styles.guardianAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.guardianAvatar, styles.guardianAvatarPlaceholder]}>
                  <IconSymbol name="person.fill" size={20} color="#fff" />
                </View>
              )}
              <View style={styles.guardianMarkerDot} />
            </View>
          </Marker>
        ))}

        {/* User Location Marker with Avatar */}
        {isValidCoordinate(userLocation) && (
          <Marker
            coordinate={{
              latitude: userLocation!.latitude,
              longitude: userLocation!.longitude,
            }}
            title={userName || 'You'}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={999}>
            <View style={styles.userLocationMarker}>
              {/* Pulsing circle effect (background) */}
              <View style={styles.userLocationPulse} />
              {/* Avatar */}
              {userAvatar ? (
                <ExpoImage
                  source={{ uri: userAvatar }}
                  style={styles.userAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
                  <IconSymbol name="person.fill" size={24} color="#fff" />
                </View>
              )}
            </View>
          </Marker>
        )}
      </MapView>
      
      {/* Custom Location Button - positioned above bottom sheet */}
      <TouchableOpacity
        style={styles.locationButton}
        onPress={handleLocationPress}
        activeOpacity={0.7}>
        <IconSymbol name="location.fill" size={24} color="#5170FF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  map: {
    flex: 1,
  },
  locationButton: {
    position: 'absolute',
    top: 120,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guardianMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardianAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#5170FF',
  },
  guardianAvatarPlaceholder: {
    backgroundColor: '#5170FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guardianMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#5170FF',
    borderWidth: 2,
    borderColor: '#fff',
    marginTop: -6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  destinationMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  // User Location Marker Styles
  userLocationMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
  },
  userAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: '#5170FF',
    shadowColor: '#5170FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 2,
  },
  userAvatarPlaceholder: {
    backgroundColor: '#5170FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userLocationPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(81, 112, 255, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(81, 112, 255, 0.25)',
    zIndex: 1,
  },
});
