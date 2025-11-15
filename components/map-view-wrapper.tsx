import { IconSymbol } from '@/components/ui/icon-symbol';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

interface MapViewWrapperProps {
  userLocation?: { latitude: number; longitude: number };
  destination?: { latitude: number; longitude: number };
  onLocationButtonPress?: () => void;
}

export function MapViewWrapper({
  userLocation,
  destination,
  onLocationButtonPress,
}: MapViewWrapperProps) {
  const mapRef = useRef<MapView>(null);

  // Move camera to user location when it becomes available
  useEffect(() => {
    if (userLocation && userLocation.latitude && userLocation.longitude && 
        !isNaN(userLocation.latitude) && !isNaN(userLocation.longitude) &&
        userLocation.latitude !== 0 && userLocation.longitude !== 0 && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  }, [userLocation?.latitude, userLocation?.longitude]);

  // Handle location button press
  const handleLocationPress = () => {
    if (onLocationButtonPress) {
      onLocationButtonPress();
    }
    
    // Move camera to user location
    if (userLocation && userLocation.latitude && userLocation.longitude && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
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
        followsUserLocation={true}
        userLocationPriority="high"
        userLocationUpdateInterval={5000}
        userLocationFastestInterval={2000}
        onUserLocationChange={(e) => {
          if (e.nativeEvent.coordinate) {
            console.log('User location updated:', e.nativeEvent.coordinate);
            // Rotate map based on user heading (direction of movement)
            if (e.nativeEvent.coordinate.heading !== undefined && 
                e.nativeEvent.coordinate.heading >= 0 && 
                mapRef.current) {
              mapRef.current.animateCamera({
                center: {
                  latitude: e.nativeEvent.coordinate.latitude,
                  longitude: e.nativeEvent.coordinate.longitude,
                },
                heading: e.nativeEvent.coordinate.heading,
                pitch: 0,
                altitude: 0,
                zoom: 15,
              }, { duration: 500 });
            }
          }
        }}>
        {/* Destination marker */}
        {destination && destination.latitude && destination.longitude && (
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            pinColor="#34C759"
            title="Destination"
          />
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
    top: 60,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
