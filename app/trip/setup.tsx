import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Picker } from '@react-native-picker/picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useGuardian } from '@/hooks/use-guardian';
import { useAuth } from '@/providers/auth-provider';
import { useLocation } from '@/hooks/use-location';
import { useTrip } from '@/hooks/use-trip';
import type { TripMode } from '@/services/trip-service';
import type { GuardianWithProfile } from '@/services/guardian-service';
import { searchAddresses, reverseGeocode, type GeocodedAddress } from '@/services/geocoding-service';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetTextInput, BottomSheetFlatList } from '@gorhom/bottom-sheet';

export default function TripSetupScreen() {
  const params = useLocalSearchParams<{
    destinationName: string;
    destinationAddress: string;
    destinationLat: string;
    destinationLng: string;
  }>();

  const { user } = useAuth();
  const { guardians } = useGuardian();
  const { location, getCurrentLocation, requestPermission } = useLocation();
  const { startTrip } = useTrip();

  // Destination from params
  const destination: GeocodedAddress = {
    name: params.destinationName || '',
    address: params.destinationAddress || '',
    formattedAddress: params.destinationAddress || '',
    latitude: parseFloat(params.destinationLat || '0'),
    longitude: parseFloat(params.destinationLng || '0'),
  };

  // Origin state
  const [origin, setOrigin] = useState<GeocodedAddress | null>(null);
  const [isLoadingCurrentLocation, setIsLoadingCurrentLocation] = useState(false);
  const [showOriginSearch, setShowOriginSearch] = useState(false);
  const [originSearchQuery, setOriginSearchQuery] = useState('');
  const [originSearchResults, setOriginSearchResults] = useState<GeocodedAddress[]>([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const originSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const originSheetRef = useRef<BottomSheet>(null);

  // Trip settings
  const [selectedMode, setSelectedMode] = useState<TripMode>('interval');
  const [checkinInterval, setCheckinInterval] = useState<number | 'custom'>(5);
  const [customIntervalValue, setCustomIntervalValue] = useState<number>(15);
  const [showCustomPickerModal, setShowCustomPickerModal] = useState(false);
  const [selectedGuardians, setSelectedGuardians] = useState<string[]>([]);
  const [showGuardianSelector, setShowGuardianSelector] = useState(false);
  const [isStartingTrip, setIsStartingTrip] = useState(false);

  const originSnapPoints = ['90%'];

  // Auto-load current location as origin on mount
  useEffect(() => {
    handleUseCurrentLocation();
  }, []);

  // Debounced origin search
  useEffect(() => {
    if (originSearchTimeoutRef.current) {
      clearTimeout(originSearchTimeoutRef.current);
    }

    if (originSearchQuery.trim().length >= 2) {
      setIsSearchingOrigin(true);
      originSearchTimeoutRef.current = setTimeout(async () => {
        const { data, error } = await searchAddresses(originSearchQuery);
        if (error) {
          setOriginSearchResults([]);
        } else {
          setOriginSearchResults(data || []);
        }
        setIsSearchingOrigin(false);
      }, 400);
    } else {
      setOriginSearchResults([]);
      setIsSearchingOrigin(false);
    }

    return () => {
      if (originSearchTimeoutRef.current) {
        clearTimeout(originSearchTimeoutRef.current);
      }
    };
  }, [originSearchQuery]);

  const handleUseCurrentLocation = useCallback(async () => {
    setIsLoadingCurrentLocation(true);
    const hasPermission = await requestPermission();
    
    if (!hasPermission) {
      setIsLoadingCurrentLocation(false);
      Alert.alert('Permission Required', 'Location permission is needed to use your current location.');
      return;
    }

    const currentLocation = await getCurrentLocation();
    
    if (currentLocation?.coords) {
      const { data, error } = await reverseGeocode(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude
      );

      if (!error && data) {
        setOrigin(data);
      }
    }
    
    setIsLoadingCurrentLocation(false);
  }, [getCurrentLocation, requestPermission]);

  const handleSelectOrigin = useCallback((address: GeocodedAddress) => {
    setOrigin(address);
    setShowOriginSearch(false);
    setOriginSearchQuery('');
    setOriginSearchResults([]);
    Keyboard.dismiss();
  }, []);

  const handleOpenOriginSearch = useCallback(() => {
    setShowOriginSearch(true);
    setOriginSearchQuery('');
    setOriginSearchResults([]);
    setTimeout(() => {
      originSheetRef.current?.expand();
    }, 100);
  }, []);

  const handleCloseOriginSearch = useCallback(() => {
    setShowOriginSearch(false);
    setOriginSearchQuery('');
    setOriginSearchResults([]);
    Keyboard.dismiss();
  }, []);

  async function handleStartTrip() {
    if (!origin || !destination) {
      Alert.alert('Missing Information', 'Please select both origin and destination.');
      return;
    }

    setIsStartingTrip(true);

    try {
      let actualInterval = checkinInterval;
      if (checkinInterval === 'custom') {
        actualInterval = customIntervalValue;
      }

      const { data, error } = await startTrip({
        mode: selectedMode,
        checkinIntervalMinutes: typeof actualInterval === 'number' ? actualInterval : 5,
        safetogetherEnabled: false,
        originLatitude: origin.latitude,
        originLongitude: origin.longitude,
        originAddress: origin.formattedAddress,
        destinationLatitude: destination.latitude,
        destinationLongitude: destination.longitude,
        destinationAddress: destination.formattedAddress,
        guardianIds: selectedGuardians.length > 0 ? selectedGuardians : undefined,
      });

      if (error) {
        Alert.alert('Error', 'Could not start trip. Please try again.');
        setIsStartingTrip(false);
        return;
      }

      router.replace('/trip/active');
    } catch (error) {
      console.error('Error starting trip:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setIsStartingTrip(false);
    }
  }

  const modes: { value: TripMode; label: string; description: string; icon: string }[] = [
    { value: 'silent', label: 'Silent', description: 'No check-ins', icon: 'moon.fill' },
    { value: 'interval', label: 'Interval', description: 'Regular check-ins', icon: 'clock.fill' },
    { value: 'continuous', label: 'Continuous', description: 'Live tracking', icon: 'location.fill' },
  ];

  const intervals: (number | 'custom')[] = [3, 5, 10, 'custom'];

  const getOtherUser = useCallback(
    (guardian: GuardianWithProfile) => {
      if (guardian.requester_id === user?.id) {
        return guardian.recipient_profile;
      }
      return guardian.requester_profile;
    },
    [user]
  );

  const renderAvatar = useCallback(
    (profile: { avatar_url: string | null; username: string | null; full_name: string | null }) => {
      const firstLetter = (profile.username || profile.full_name || '?')[0].toUpperCase();

      if (profile.avatar_url) {
        return (
          <Image
            source={{ uri: profile.avatar_url }}
            style={styles.avatarSmall}
            contentFit="cover"
          />
        );
      }

      return (
        <View style={[styles.avatarSmall, styles.avatarPlaceholderSmall]}>
          <Text style={styles.avatarTextSmall}>{firstLetter}</Text>
        </View>
      );
    },
    []
  );

  const toggleGuardian = useCallback((guardianId: string) => {
    setSelectedGuardians((prev) =>
      prev.includes(guardianId) ? prev.filter((id) => id !== guardianId) : [...prev, guardianId]
    );
  }, []);

  const renderGuardianItem = useCallback(
    ({ item }: { item: GuardianWithProfile }) => {
      const otherUser = getOtherUser(item);
      const isSelected = selectedGuardians.includes(otherUser.id);

      return (
        <TouchableOpacity
          style={[styles.guardianItem, isSelected && styles.guardianItemSelected]}
          onPress={() => toggleGuardian(otherUser.id)}
          activeOpacity={0.7}>
          {renderAvatar(otherUser)}
          <View style={styles.guardianItemInfo}>
            <Text style={styles.guardianItemName}>
              {otherUser.full_name || otherUser.username || 'Unknown'}
            </Text>
            {otherUser.username && (
              <Text style={styles.guardianItemUsername}>@{otherUser.username}</Text>
            )}
          </View>
          <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
            {isSelected && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>
      );
    },
    [getOtherUser, renderAvatar, selectedGuardians, toggleGuardian]
  );

  const renderOriginSearchResult = useCallback(
    ({ item }: { item: GeocodedAddress }) => (
      <TouchableOpacity
        style={styles.searchResultItem}
        onPress={() => handleSelectOrigin(item)}
        activeOpacity={0.7}>
        <View style={styles.searchResultIcon}>
          <IconSymbol name="mappin" size={18} color="#5170FF" />
        </View>
        <View style={styles.searchResultContent}>
          <Text style={styles.searchResultName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.searchResultAddress} numberOfLines={2}>
            {item.formattedAddress}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [handleSelectOrigin]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={20} color="#5170FF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan Trip</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        
        {/* Route Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route</Text>
          
          <View style={styles.routeContainer}>
            {/* Origin */}
            <TouchableOpacity 
              style={styles.routeCard}
              onPress={handleOpenOriginSearch}
              activeOpacity={0.7}>
              <View style={styles.routeIconContainer}>
                <View style={styles.originDot} />
              </View>
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>From</Text>
                {isLoadingCurrentLocation ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#5170FF" />
                    <Text style={styles.routeLoadingText}>Getting location...</Text>
                  </View>
                ) : origin ? (
                  <Text style={styles.routeAddress} numberOfLines={2}>{origin.formattedAddress}</Text>
                ) : (
                  <Text style={styles.routePlaceholder}>Select starting point</Text>
                )}
              </View>
              <IconSymbol name="chevron.right" size={18} color="rgba(0,0,0,0.2)" />
            </TouchableOpacity>

            {/* Route Line */}
            <View style={styles.routeLineContainer}>
              <View style={styles.routeLine} />
            </View>

            {/* Destination */}
            <View style={styles.routeCard}>
              <View style={styles.routeIconContainer}>
                <View style={styles.destinationDot} />
              </View>
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>To</Text>
                <Text style={styles.routeAddress} numberOfLines={2}>{destination.formattedAddress}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Mode Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mode</Text>
          
          <View style={styles.modeContainer}>
            {modes.map((mode) => (
              <TouchableOpacity
                key={mode.value}
                style={[
                  styles.modeCard,
                  selectedMode === mode.value && styles.modeCardSelected,
                ]}
                onPress={() => setSelectedMode(mode.value)}
                activeOpacity={0.7}>
                <View style={[
                  styles.modeIconContainer,
                  selectedMode === mode.value && styles.modeIconContainerSelected
                ]}>
                  <IconSymbol 
                    name={mode.icon as any} 
                    size={18} 
                    color={selectedMode === mode.value ? '#fff' : '#5170FF'} 
                  />
                </View>
                <Text style={[
                  styles.modeTitle,
                  selectedMode === mode.value && styles.modeTitleSelected
                ]}>
                  {mode.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Check-in Interval */}
        {selectedMode !== 'silent' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interval</Text>
            
            <View style={styles.intervalContainer}>
              {intervals.map((interval) => (
                <TouchableOpacity
                  key={interval}
                  style={[
                    styles.intervalCard,
                    checkinInterval === interval && styles.intervalCardSelected,
                  ]}
                  onPress={() => {
                    if (interval === 'custom') {
                      setShowCustomPickerModal(true);
                      setCheckinInterval('custom');
                    } else {
                      setCheckinInterval(interval);
                    }
                  }}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.intervalValue,
                      checkinInterval === interval && styles.intervalValueSelected,
                    ]}>
                    {interval === 'custom' 
                      ? (checkinInterval === 'custom' ? customIntervalValue : '...')
                      : interval}
                  </Text>
                  <Text
                    style={[
                      styles.intervalLabel,
                      checkinInterval === interval && styles.intervalLabelSelected,
                    ]}>
                    min
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Guardians */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Guardians</Text>
          
          <TouchableOpacity
            style={styles.guardianSelector}
            onPress={() => {
              if (guardians.length === 0) {
                Alert.alert(
                  'No Guardians',
                  'Add Guardians in SafeTogether to share your trips.'
                );
                return;
              }
              setShowGuardianSelector(true);
            }}
            activeOpacity={0.7}>
            <View style={styles.guardianIconContainer}>
              <IconSymbol name="person.2.fill" size={18} color="#5170FF" />
            </View>
            <View style={styles.guardianSelectorContent}>
              <Text style={styles.guardianSelectorTitle}>
                {selectedGuardians.length > 0 
                  ? `${selectedGuardians.length} selected`
                  : 'None selected'}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={18} color="rgba(0,0,0,0.2)" />
          </TouchableOpacity>
        </View>

        {/* Spacer */}
        <View style={{ height: 24 }} />

        {/* Start Button */}
        <TouchableOpacity
          style={[styles.startButton, isStartingTrip && styles.startButtonDisabled]}
          onPress={handleStartTrip}
          disabled={isStartingTrip || !origin}
          activeOpacity={0.8}>
          {isStartingTrip ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.startButtonText}>Start Trip</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Origin Search Sheet */}
      {showOriginSearch && (
        <BottomSheet
          ref={originSheetRef}
          index={0}
          snapPoints={originSnapPoints}
          enablePanDownToClose
          onClose={handleCloseOriginSearch}
          backgroundStyle={styles.sheetBackground}
          handleIndicatorStyle={styles.sheetHandle}>
          <View style={styles.sheetContent}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={handleCloseOriginSearch} style={styles.sheetCloseButton}>
                <IconSymbol name="chevron.left" size={20} color="#5170FF" />
              </TouchableOpacity>
              <Text style={styles.sheetHeaderTitle}>Starting Point</Text>
              <View style={{ width: 44 }} />
            </View>

            {/* Current Location Button */}
            <TouchableOpacity 
              style={styles.currentLocationButton}
              onPress={async () => {
                await handleUseCurrentLocation();
                handleCloseOriginSearch();
              }}
              activeOpacity={0.7}>
              <View style={styles.currentLocationIcon}>
                <IconSymbol name="location.fill" size={18} color="#5170FF" />
              </View>
              <Text style={styles.currentLocationText}>Use current location</Text>
            </TouchableOpacity>

            {/* Search Input */}
            <View style={styles.searchInputContainer}>
              <View style={styles.searchInputWrapper}>
                <IconSymbol name="magnifyingglass" size={18} color="rgba(0,0,0,0.3)" />
                <BottomSheetTextInput
                  style={styles.searchInput}
                  placeholder="Search address..."
                  placeholderTextColor="rgba(0,0,0,0.35)"
                  value={originSearchQuery}
                  onChangeText={setOriginSearchQuery}
                  autoFocus
                  returnKeyType="search"
                />
                {originSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setOriginSearchQuery('')}>
                    <IconSymbol name="xmark.circle.fill" size={18} color="rgba(0,0,0,0.2)" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Search Results */}
            {isSearchingOrigin ? (
              <View style={styles.searchLoadingContainer}>
                <ActivityIndicator size="small" color="#5170FF" />
              </View>
            ) : originSearchResults.length > 0 ? (
              <BottomSheetFlatList
                data={originSearchResults}
                renderItem={renderOriginSearchResult}
                keyExtractor={(item, index) => `${item.latitude}-${item.longitude}-${index}`}
                contentContainerStyle={styles.searchResultsList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              />
            ) : null}
          </View>
        </BottomSheet>
      )}

      {/* Guardian Selection Modal */}
      <Modal
        visible={showGuardianSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGuardianSelector(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Guardians</Text>
              <TouchableOpacity
                onPress={() => setShowGuardianSelector(false)}
                style={styles.modalCloseButton}>
                <IconSymbol name="xmark" size={16} color="#5170FF" />
              </TouchableOpacity>
            </View>

            {guardians.length > 0 ? (
              <FlatList
                data={guardians}
                renderItem={renderGuardianItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.modalListContent}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.modalEmptyContainer}>
                <Text style={styles.modalEmptyText}>No Guardians yet</Text>
              </View>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalDoneButton}
                onPress={() => setShowGuardianSelector(false)}>
                <Text style={styles.modalDoneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Interval Picker Modal */}
      <Modal
        visible={showCustomPickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCustomPickerModal(false)}>
        <TouchableOpacity
          style={styles.pickerModalOverlay}
          activeOpacity={1}
          onPress={() => setShowCustomPickerModal(false)}>
          <View style={styles.pickerModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Custom Interval</Text>
              <TouchableOpacity
                onPress={() => setShowCustomPickerModal(false)}
                style={styles.pickerModalDoneButton}>
                <Text style={styles.pickerModalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerModalPickerWrapper}>
              <Picker
                selectedValue={customIntervalValue}
                onValueChange={(itemValue) => setCustomIntervalValue(itemValue)}
                style={styles.pickerModalPicker}
                itemStyle={Platform.OS === 'ios' ? styles.pickerModalItemIOS : undefined}>
                {Array.from({ length: 60 }, (_, i) => i + 1).map((value) => (
                  <Picker.Item
                    key={value}
                    label={`${value} minutes`}
                    value={value}
                  />
                ))}
              </Picker>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(81, 112, 255, 0.08)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(81, 112, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.4)',
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Route Section
  routeContainer: {
    backgroundColor: 'rgba(81, 112, 255, 0.04)',
    borderRadius: 20,
    padding: 4,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  routeIconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  originDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#B4FF39',
    borderWidth: 3,
    borderColor: 'rgba(180, 255, 57, 0.3)',
  },
  destinationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#5170FF',
    borderWidth: 3,
    borderColor: 'rgba(81, 112, 255, 0.3)',
  },
  routeContent: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.4)',
    marginBottom: 4,
  },
  routeAddress: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  routePlaceholder: {
    fontSize: 15,
    color: 'rgba(0,0,0,0.3)',
    letterSpacing: -0.2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeLoadingText: {
    fontSize: 15,
    color: 'rgba(0,0,0,0.4)',
  },
  routeLineContainer: {
    paddingLeft: 30,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: 'rgba(81, 112, 255, 0.15)',
    borderRadius: 1,
  },
  // Mode Cards
  modeContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  modeCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(81, 112, 255, 0.04)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeCardSelected: {
    borderColor: '#5170FF',
    backgroundColor: 'rgba(81, 112, 255, 0.08)',
  },
  modeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(81, 112, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  modeIconContainerSelected: {
    backgroundColor: '#5170FF',
  },
  modeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.5)',
    letterSpacing: -0.1,
  },
  modeTitleSelected: {
    color: '#5170FF',
  },
  // Interval Cards
  intervalContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  intervalCard: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: 'rgba(81, 112, 255, 0.04)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  intervalCardSelected: {
    borderColor: '#5170FF',
    backgroundColor: 'rgba(81, 112, 255, 0.08)',
  },
  intervalValue: {
    fontSize: 26,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.25)',
    letterSpacing: -1,
  },
  intervalValueSelected: {
    color: '#5170FF',
  },
  intervalLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(0, 0, 0, 0.25)',
    marginTop: 2,
  },
  intervalLabelSelected: {
    color: '#5170FF',
  },
  // Guardian Selector
  guardianSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(81, 112, 255, 0.04)',
    borderRadius: 16,
    padding: 16,
  },
  guardianIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(81, 112, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  guardianSelectorContent: {
    flex: 1,
  },
  guardianSelectorTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
    letterSpacing: -0.2,
  },
  // Start Button
  startButton: {
    backgroundColor: '#5170FF',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  // Avatar Styles
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholderSmall: {
    backgroundColor: '#5170FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextSmall: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Radio Button
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(81, 112, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#5170FF',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#5170FF',
  },
  // Guardian Item
  guardianItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(81, 112, 255, 0.04)',
  },
  guardianItemSelected: {
    backgroundColor: 'rgba(81, 112, 255, 0.12)',
  },
  guardianItemInfo: {
    flex: 1,
    marginLeft: 14,
  },
  guardianItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    letterSpacing: -0.2,
  },
  guardianItemUsername: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.4)',
    marginTop: 1,
  },
  // Sheet Styles
  sheetBackground: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetHandle: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    width: 36,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 16,
  },
  sheetCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(81, 112, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    letterSpacing: -0.3,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(81, 112, 255, 0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  currentLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(81, 112, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentLocationText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#5170FF',
    letterSpacing: -0.2,
  },
  searchInputContainer: {
    marginBottom: 16,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(81, 112, 255, 0.06)',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    letterSpacing: -0.2,
  },
  searchLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  searchResultsList: {
    paddingBottom: 40,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(81, 112, 255, 0.06)',
  },
  searchResultIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(81, 112, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  searchResultAddress: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.5)',
    lineHeight: 19,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.4,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(81, 112, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalListContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  modalEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  modalEmptyText: {
    fontSize: 16,
    color: 'rgba(0,0,0,0.4)',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalDoneButton: {
    backgroundColor: '#5170FF',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalDoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Picker Modal
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  pickerModalDoneButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pickerModalDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5170FF',
  },
  pickerModalPickerWrapper: {
    height: 216,
    overflow: 'hidden',
  },
  pickerModalPicker: {
    height: 216,
    width: '100%',
  },
  pickerModalItemIOS: {
    color: '#000',
  },
});

