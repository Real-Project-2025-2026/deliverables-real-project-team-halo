import { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import { useTrip } from '@/hooks/use-trip';
import { useLocation } from '@/hooks/use-location';
import { useGuardian } from '@/hooks/use-guardian';
import { useAuth } from '@/providers/auth-provider';
import { startBackgroundLocationTracking } from '@/services/background-location';
import type { TripMode } from '@/services/trip-service';
import type { GuardianWithProfile } from '@/services/guardian-service';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MapViewWrapper } from '@/components/map-view-wrapper';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function StartTripScreen() {
  const { user } = useAuth();
  const { startTrip, isLoading } = useTrip();
  const { location, getCurrentLocation, requestPermission, permissionStatus } = useLocation();
  const { guardians } = useGuardian();
  const bottomSheetRef = useRef<BottomSheet>(null);

  const [selectedMode, setSelectedMode] = useState<TripMode>('interval');
  const [checkinInterval, setCheckinInterval] = useState<number | 'custom'>(5);
  const [customIntervalValue, setCustomIntervalValue] = useState<number>(15);
  const [showCustomPickerModal, setShowCustomPickerModal] = useState(false);
  const [safetogetherEnabled, setSafetogetherEnabled] = useState(false);
  const [selectedGuardians, setSelectedGuardians] = useState<string[]>([]);
  const [showGuardianSelector, setShowGuardianSelector] = useState(false);

  const snapPoints = useMemo(() => ['90%'], []);

  async function handleStartTrip() {
    try {
      if (permissionStatus !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          Alert.alert(
            'Permission Required',
            'Location permission is required to start a trip.'
          );
          return;
        }
      }

      const currentLocation = await getCurrentLocation();
      if (!currentLocation) {
        Alert.alert('Error', 'Could not get your current location. Please try again.');
        return;
      }

      // Determine the actual interval value
      let actualInterval = checkinInterval;
      if (checkinInterval === 'custom') {
        actualInterval = customIntervalValue;
      }

      const { success, trip, error } = await startTrip({
        mode: selectedMode,
        checkinIntervalMinutes: actualInterval as number,
        safetogetherEnabled,
        guardianIds: selectedGuardians.length > 0 ? selectedGuardians : undefined,
        originLatitude: currentLocation.coords.latitude,
        originLongitude: currentLocation.coords.longitude,
      });

      if (!success || !trip) {
        const errorMessage = error || 'Failed to start trip. Please try again.';
        Alert.alert('Error', errorMessage);
        console.error('Trip start error:', error);
        return;
      }

      // Start background location tracking if needed
      if (selectedMode !== 'silent') {
        await startBackgroundLocationTracking();
      }

      // Navigate to active trip screen
      router.replace('/trip/active');
    } catch (error) {
      console.error('Error starting trip:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  }

  const modes: { value: TripMode; label: string; icon: string }[] = [
    { value: 'silent', label: 'Silent', icon: 'moon.fill' },
    { value: 'interval', label: 'Interval', icon: 'clock.fill' },
    { value: 'continuous', label: 'Continuous', icon: 'location.fill' },
  ];

  const intervals: (number | 'custom')[] = [3, 5, 10, 'custom'];

  // Get the other user from a Guardian relationship
  const getOtherUser = useCallback(
    (guardian: GuardianWithProfile) => {
      if (guardian.requester_id === user?.id) {
        return guardian.recipient_profile;
      }
      return guardian.requester_profile;
    },
    [user]
  );

  // Render avatar or placeholder
  const renderAvatar = useCallback(
    (profile: { avatar_url: string | null; username: string | null; full_name: string | null }) => {
      const firstLetter = (profile.username || profile.full_name || '?')[0].toUpperCase();

      if (profile.avatar_url) {
        return (
          <Image
            source={{ uri: profile.avatar_url }}
            style={styles.avatarSmall}
            contentFit="cover"
            transition={200}
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
          onPress={() => toggleGuardian(otherUser.id)}>
          {renderAvatar(otherUser)}
          <View style={styles.guardianItemInfo}>
            <Text style={styles.guardianItemUsername}>
              @{otherUser.username || 'unknown'}
            </Text>
            {otherUser.full_name && (
              <Text style={styles.guardianItemName}>{otherUser.full_name}</Text>
            )}
          </View>
          {isSelected && (
            <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      );
    },
    [getOtherUser, renderAvatar, selectedGuardians, toggleGuardian]
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <MapViewWrapper
        userLocation={
          location
            ? {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }
            : undefined
        }
      />

      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.handleIndicator}>
        <BottomSheetScrollView style={styles.contentContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Start Trip</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Mode Selection */}
          <Text style={styles.sectionTitle}>Select Mode</Text>
          {modes.map((mode) => (
            <TouchableOpacity
              key={mode.value}
              style={[
                styles.modeCard,
                selectedMode === mode.value && styles.modeCardSelected,
              ]}
              onPress={() => setSelectedMode(mode.value)}>
              <View style={styles.modeIcon}>
                <IconSymbol
                  name={mode.icon as any}
                  size={24}
                  color="#fff"
                />
              </View>
              <Text
                style={[
                  styles.modeLabel,
                  selectedMode === mode.value && styles.modeLabelSelected,
                ]}>
                {mode.label}
              </Text>
              {selectedMode === mode.value && (
                <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />
              )}
            </TouchableOpacity>
          ))}

          {/* Check-in Interval */}
          {selectedMode !== 'silent' && (
            <>
              <Text style={styles.sectionTitle}>Check-in Interval</Text>
              <View style={styles.intervalContainer}>
                {intervals.map((interval) => (
                  <TouchableOpacity
                    key={interval}
                    style={[
                      styles.intervalButton,
                      checkinInterval === interval && styles.intervalButtonSelected,
                    ]}
                    onPress={() => {
                      if (interval === 'custom') {
                        setShowCustomPickerModal(true);
                        setCheckinInterval('custom');
                      } else {
                        setCheckinInterval(interval);
                      }
                    }}>
                    <Text
                      style={[
                        styles.intervalText,
                        checkinInterval === interval && styles.intervalTextSelected,
                      ]}>
                      {interval === 'custom' 
                        ? (checkinInterval === 'custom' ? `${customIntervalValue}m` : 'Custom')
                        : `${interval}m`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* SafeTogether - Connect with Guardians */}
          <Text style={styles.sectionTitle}>SafeTogether</Text>
          
          {/* Connect with my Guardians */}
          <TouchableOpacity
            style={styles.guardianCard}
            onPress={() => {
              if (guardians.length === 0) {
                Alert.alert(
                  'No Guardians',
                  'You need to add Guardians first. Go to the SafeTogether tab to add Guardians.'
                );
                return;
              }
              setShowGuardianSelector(true);
            }}>
            <View style={styles.toggleIcon}>
              <IconSymbol name="person.2.fill" size={24} color="#fff" />
            </View>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Connect with my Guardians</Text>
              {selectedGuardians.length > 0 && (
                <Text style={styles.toggleSubtext}>
                  {selectedGuardians.length} Guardian{selectedGuardians.length !== 1 ? 's' : ''} selected
                </Text>
              )}
              {guardians.length === 0 && (
                <Text style={styles.toggleSubtext}>No Guardians yet</Text>
              )}
            </View>
            <IconSymbol name="chevron.right" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Connect with nearby users (secondary option) */}
          <TouchableOpacity
            style={[styles.toggleCard, styles.toggleCardSecondary]}
            onPress={() => setSafetogetherEnabled(!safetogetherEnabled)}>
            <View style={styles.toggleIcon}>
              <IconSymbol name="location.fill" size={24} color="#fff" />
            </View>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Connect with nearby users</Text>
              <Text style={styles.toggleSubtext}>Coming soon</Text>
            </View>
            <View
              style={[
                styles.switch,
                safetogetherEnabled && styles.switchActive,
              ]}>
              <View
                style={[
                  styles.switchThumb,
                  safetogetherEnabled && styles.switchThumbActive,
                ]}
              />
            </View>
          </TouchableOpacity>

          {/* Start Button */}
          <TouchableOpacity
            style={[styles.startButton, isLoading && styles.startButtonDisabled]}
            onPress={handleStartTrip}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#5170FF" />
            ) : (
              <>
                <IconSymbol name="play.fill" size={20} color="#5170FF" />
                <Text style={styles.startButtonText}>Start Trip</Text>
              </>
            )}
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Guardian Selection Modal */}
      <Modal
        visible={showGuardianSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGuardianSelector(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Guardians</Text>
              <TouchableOpacity
                onPress={() => setShowGuardianSelector(false)}
                style={styles.modalCloseButton}>
                <IconSymbol name="xmark" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Guardian List */}
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
                <IconSymbol name="person.2.fill" size={64} color="rgba(255, 255, 255, 0.3)" />
                <Text style={styles.modalEmptyText}>
                  No Guardians available
                </Text>
                <Text style={styles.modalEmptySubtext}>
                  Add Guardians in the SafeTogether tab
                </Text>
              </View>
            )}

            {/* Done Button */}
            <TouchableOpacity
              style={styles.modalDoneButton}
              onPress={() => setShowGuardianSelector(false)}>
              <Text style={styles.modalDoneButtonText}>Done</Text>
            </TouchableOpacity>
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
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Minutes</Text>
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
                    label={value.toString()}
                    value={value}
                  />
                ))}
              </Picker>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bottomSheetBackground: {
    backgroundColor: '#5170FF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    width: 40,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 12,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeCardSelected: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  modeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modeLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modeLabelSelected: {
    color: '#fff',
  },
  intervalContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  intervalButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  intervalButtonSelected: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  intervalText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.8,
  },
  intervalTextSelected: {
    color: '#fff',
    opacity: 1,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 16,
    borderRadius: 12,
  },
  toggleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  switch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    padding: 2,
  },
  switchActive: {
    backgroundColor: '#fff',
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#5170FF',
    transform: [{ translateX: 0 }],
  },
  switchThumbActive: {
    backgroundColor: '#5170FF',
    transform: [{ translateX: 20 }],
  },
  startButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  startButtonText: {
    color: '#5170FF',
    fontSize: 16,
    fontWeight: '600',
  },
  guardianCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  toggleCardSecondary: {
    opacity: 0.6,
  },
  toggleSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  guardianItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  guardianItemSelected: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholderSmall: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextSmall: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  guardianItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  guardianItemUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  guardianItemName: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  emptyGuardiansText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    padding: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#5170FF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalListContent: {
    padding: 24,
    paddingTop: 16,
  },
  modalEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  modalEmptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 24,
    marginBottom: 8,
  },
  modalEmptySubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  modalDoneButton: {
    backgroundColor: '#fff',
    marginHorizontal: 24,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalDoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5170FF',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24, // Safe area for iOS
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
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
    height: 216, // Standard iOS picker height
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
