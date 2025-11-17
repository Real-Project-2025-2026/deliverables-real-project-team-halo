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
  destination?: { latitude: number; longitude: number };
  routePoints?: Array<{ latitude: number; longitude: number }>;
  guardians?: GuardianMarker[];
  onLocationButtonPress?: () => void;
}

export function MapViewWrapper({
  userLocation,
  destination,
  routePoints = [],
  guardians = [],
  onLocationButtonPress,
}: MapViewWrapperProps) {
  const mapRef = useRef<MapView>(null);
  const isUserInteractingRef = useRef(false);
  const lastManualInteractionRef = useRef(Date.now());
  const hasInitialZoomRef = useRef(false);

  // Only auto-focus on initial load, not during user interaction
  useEffect(() => {
    if (
      !hasInitialZoomRef.current &&
      userLocation &&
      userLocation.latitude &&
      userLocation.longitude &&
      !isNaN(userLocation.latitude) &&
      !isNaN(userLocation.longitude) &&
      userLocation.latitude !== 0 &&
      userLocation.longitude !== 0 &&
      mapRef.current
    ) {
      hasInitialZoomRef.current = true;
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
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
      routePoints.length > 0 &&
      mapRef.current &&
      !isUserInteractingRef.current
    ) {
      const coordinates = routePoints.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      }));

      if (userLocation) {
        coordinates.push({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        });
      }

      if (destination) {
        coordinates.push({
          latitude: destination.latitude,
          longitude: destination.longitude,
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
  }, [routePoints.length, userLocation, destination]);

  // Handle location button press
  const handleLocationPress = () => {
    if (onLocationButtonPress) {
      onLocationButtonPress();
    }
    
    // Reset user interaction flags - user explicitly wants to center on location
    isUserInteractingRef.current = false;
    lastManualInteractionRef.current = Date.now();
    
    // Move camera to user location
    if (userLocation && userLocation.latitude && userLocation.longitude && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  };

  // Initial region
  const initialRegion = userLocation && userLocation.latitude && userLocation.longitude
    ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
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
        showsUserLocation={true}
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
        }}>
        {/* Route Polyline */}
        {routePoints.length > 1 && (
          <Polyline
            coordinates={routePoints.map((point) => ({
              latitude: point.latitude,
              longitude: point.longitude,
            }))}
            strokeColor="#5170FF"
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Start marker (first route point or origin) */}
        {routePoints.length > 0 && (
          <Marker
            coordinate={{
              latitude: routePoints[0].latitude,
              longitude: routePoints[0].longitude,
            }}
            pinColor="#34C759"
            title="Start"
          />
        )}

        {/* Destination marker */}
        {destination && destination.latitude && destination.longitude && (
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            pinColor="#FF3B30"
            title="Destination"
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
});
