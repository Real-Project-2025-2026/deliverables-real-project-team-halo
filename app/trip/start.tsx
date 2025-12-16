import { useState, useCallback } from 'react';
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
} from 'react-native';
import { Image } from 'expo-image';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import { useGuardian } from '@/hooks/use-guardian';
import { useAuth } from '@/providers/auth-provider';
import type { TripMode } from '@/services/trip-service';
import type { GuardianWithProfile } from '@/services/guardian-service';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StartTripScreen() {
  const { user } = useAuth();
  const { guardians } = useGuardian();

  const [selectedMode, setSelectedMode] = useState<TripMode>('interval');
  const [checkinInterval, setCheckinInterval] = useState<number | 'custom'>(5);
  const [customIntervalValue, setCustomIntervalValue] = useState<number>(15);
  const [showCustomPickerModal, setShowCustomPickerModal] = useState(false);
  const [selectedGuardians, setSelectedGuardians] = useState<string[]>([]);
  const [showGuardianSelector, setShowGuardianSelector] = useState(false);

  async function handleStartTrip() {
    try {
      let actualInterval = checkinInterval;
      if (checkinInterval === 'custom') {
        actualInterval = customIntervalValue;
      }

      router.push({
        pathname: '/trip/route-setup',
        params: {
          mode: selectedMode,
          checkinInterval: checkinInterval.toString(),
          customIntervalValue: customIntervalValue.toString(),
          safetogetherEnabled: 'false',
          guardianIds: selectedGuardians.length > 0 ? selectedGuardians.join(',') : '',
        },
      });
    } catch (error) {
      console.error('Error navigating to route setup:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  }

  const modes: { value: TripMode; label: string; description: string; icon: string }[] = [
    { value: 'silent', label: 'Silent', description: 'No check-ins required', icon: 'moon.fill' },
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={20} color="#5170FF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        
        {/* Mode Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mode</Text>
          <Text style={styles.sectionSubtitle}>Choose how you want to be monitored</Text>
          
          <View style={styles.modeContainer}>
            {modes.map((mode, index) => (
              <TouchableOpacity
                key={mode.value}
                style={[
                  styles.modeCard,
                  selectedMode === mode.value && styles.modeCardSelected,
                  index === 0 && styles.modeCardFirst,
                  index === modes.length - 1 && styles.modeCardLast,
                ]}
                onPress={() => setSelectedMode(mode.value)}
                activeOpacity={0.7}>
                <View style={styles.modeLeft}>
                  <View style={[
                    styles.modeIconContainer,
                    selectedMode === mode.value && styles.modeIconContainerSelected
                  ]}>
                    <IconSymbol 
                      name={mode.icon as any} 
                      size={20} 
                      color={selectedMode === mode.value ? '#fff' : '#5170FF'} 
                    />
                  </View>
                  <View style={styles.modeContent}>
                    <Text style={[
                      styles.modeTitle,
                      selectedMode === mode.value && styles.modeTitleSelected
                    ]}>
                      {mode.label}
                    </Text>
                    <Text style={styles.modeDescription}>{mode.description}</Text>
                  </View>
                </View>
                <View style={[styles.radioOuter, selectedMode === mode.value && styles.radioOuterSelected]}>
                  {selectedMode === mode.value && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Check-in Interval */}
        {selectedMode !== 'silent' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Check-in Interval</Text>
            <Text style={styles.sectionSubtitle}>How often should we check on you?</Text>
            
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
                    {interval === 'custom' ? 'custom' : 'min'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Guardians */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Guardians</Text>
          <Text style={styles.sectionSubtitle}>Who should be notified about your trip?</Text>
          
          <TouchableOpacity
            style={styles.guardianSelector}
            onPress={() => {
              if (guardians.length === 0) {
                Alert.alert(
                  'No Guardians',
                  'You need to add Guardians first. Go to the SafeTogether tab to add Guardians.'
                );
                return;
              }
              setShowGuardianSelector(true);
            }}
            activeOpacity={0.7}>
            <View style={styles.guardianSelectorLeft}>
              <View style={styles.guardianIconContainer}>
                <IconSymbol name="person.2.fill" size={20} color="#5170FF" />
              </View>
              <View style={styles.guardianSelectorContent}>
                <Text style={styles.guardianSelectorTitle}>
                  {selectedGuardians.length > 0 
                    ? `${selectedGuardians.length} Guardian${selectedGuardians.length !== 1 ? 's' : ''} selected`
                    : 'Select Guardians'}
                </Text>
                <Text style={styles.guardianSelectorSubtitle}>
                  {guardians.length === 0 
                    ? 'No Guardians added yet' 
                    : `${guardians.length} available`}
                </Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={18} color="#5170FF" />
          </TouchableOpacity>

          {/* Selected Guardians Preview */}
          {selectedGuardians.length > 0 && (
            <View style={styles.selectedGuardiansPreview}>
              {guardians
                .filter(g => {
                  const otherUser = getOtherUser(g);
                  return selectedGuardians.includes(otherUser.id);
                })
                .slice(0, 3)
                .map((guardian, index) => {
                  const otherUser = getOtherUser(guardian);
                  return (
                    <View 
                      key={otherUser.id} 
                      style={[
                        styles.previewAvatar,
                        { marginLeft: index > 0 ? -12 : 0, zIndex: 3 - index }
                      ]}>
                      {renderAvatar(otherUser)}
                    </View>
                  );
                })}
              {selectedGuardians.length > 3 && (
                <View style={[styles.previewAvatar, styles.previewMore, { marginLeft: -12 }]}>
                  <Text style={styles.previewMoreText}>+{selectedGuardians.length - 3}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Spacer */}
        <View style={{ height: 32 }} />

        {/* Continue Button */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleStartTrip}
          activeOpacity={0.8}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>

        {/* Helper Text */}
        <Text style={styles.helperText}>
          You can modify these settings during your trip
        </Text>
      </ScrollView>

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
                <View style={styles.emptyIconContainer}>
                  <IconSymbol name="person.2.fill" size={32} color="#5170FF" />
                </View>
                <Text style={styles.modalEmptyText}>No Guardians yet</Text>
                <Text style={styles.modalEmptySubtext}>
                  Add Guardians in SafeTogether to share your trips with them
                </Text>
              </View>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalDoneButton}
                onPress={() => setShowGuardianSelector(false)}>
                <Text style={styles.modalDoneButtonText}>
                  {selectedGuardians.length > 0 
                    ? `Done (${selectedGuardians.length} selected)` 
                    : 'Done'}
                </Text>
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
    paddingTop: 32,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: 'rgba(0, 0, 0, 0.5)',
    marginBottom: 20,
    letterSpacing: -0.2,
  },
  // Mode Cards
  modeContainer: {
    backgroundColor: 'rgba(81, 112, 255, 0.04)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(81, 112, 255, 0.06)',
  },
  modeCardFirst: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modeCardLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  modeCardSelected: {
    backgroundColor: 'rgba(81, 112, 255, 0.08)',
  },
  modeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(81, 112, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modeIconContainerSelected: {
    backgroundColor: '#5170FF',
  },
  modeContent: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  modeTitleSelected: {
    color: '#5170FF',
  },
  modeDescription: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.4)',
    letterSpacing: -0.1,
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
  // Interval Cards
  intervalContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  intervalCard: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: 'rgba(81, 112, 255, 0.04)',
    borderRadius: 20,
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
    fontSize: 32,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.3)',
    letterSpacing: -1,
  },
  intervalValueSelected: {
    color: '#5170FF',
  },
  intervalLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(0, 0, 0, 0.3)',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  intervalLabelSelected: {
    color: '#5170FF',
  },
  // Guardian Selector
  guardianSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(81, 112, 255, 0.04)',
    borderRadius: 20,
    padding: 20,
  },
  guardianSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  guardianIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(81, 112, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  guardianSelectorContent: {
    flex: 1,
  },
  guardianSelectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  guardianSelectorSubtitle: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.4)',
    letterSpacing: -0.1,
  },
  // Selected Guardians Preview
  selectedGuardiansPreview: {
    flexDirection: 'row',
    marginTop: 16,
    paddingLeft: 4,
  },
  previewAvatar: {
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 24,
  },
  previewMore: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#5170FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  // Continue Button
  continueButton: {
    backgroundColor: '#5170FF',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  helperText: {
    fontSize: 13,
    color: 'rgba(0, 0, 0, 0.35)',
    textAlign: 'center',
    marginTop: 16,
    letterSpacing: -0.1,
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
    letterSpacing: -0.1,
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
    maxHeight: '85%',
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
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(81, 112, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalEmptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  modalEmptySubtext: {
    fontSize: 15,
    color: 'rgba(0, 0, 0, 0.4)',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: -0.2,
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
    letterSpacing: -0.2,
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
    letterSpacing: -0.3,
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
