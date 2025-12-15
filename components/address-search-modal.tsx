import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { searchAddresses, reverseGeocode, type GeocodedAddress } from '@/services/geocoding-service';
import { useLocation } from '@/hooks/use-location';

interface AddressSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAddress: (address: GeocodedAddress) => void;
  initialAddress?: GeocodedAddress | null;
  title?: string;
  showCurrentLocation?: boolean;
}

export function AddressSearchModal({
  visible,
  onClose,
  onSelectAddress,
  initialAddress,
  title = 'Adresse suchen',
  showCurrentLocation = true,
}: AddressSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodedAddress[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<GeocodedAddress | null>(initialAddress || null);
  const { getCurrentLocation, requestPermission } = useLocation();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const snapPoints = ['90%'];

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.expand();
      setSearchQuery(initialAddress?.formattedAddress || '');
      setSelectedAddress(initialAddress || null);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible, initialAddress]);

  // Debounced address search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        const { data, error } = await searchAddresses(searchQuery);
        if (error) {
          console.error('Address search error:', error);
          setSearchResults([]);
        } else {
          setSearchResults(data || []);
        }
        setIsSearching(false);
      }, 500);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleUseCurrentLocation = useCallback(async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) {
      return;
    }

    setIsSearching(true);
    const location = await getCurrentLocation();
    
    if (location?.coords) {
      const { data, error } = await reverseGeocode(
        location.coords.latitude,
        location.coords.longitude
      );

      if (error || !data) {
        console.error('Reverse geocoding error:', error);
        setIsSearching(false);
        return;
      }

      setSelectedAddress(data);
      setSearchQuery(data.formattedAddress);
      setSearchResults([]);
    }
    
    setIsSearching(false);
  }, [getCurrentLocation, requestPermission]);

  const handleSelectAddress = useCallback((address: GeocodedAddress) => {
    setSelectedAddress(address);
    setSearchQuery(address.formattedAddress);
    setSearchResults([]);
    Keyboard.dismiss();
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedAddress) {
      onSelectAddress(selectedAddress);
      onClose();
    }
  }, [selectedAddress, onSelectAddress, onClose]);

  const handleClear = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedAddress(null);
  }, []);

  const renderSearchResult = useCallback(
    ({ item }: { item: GeocodedAddress }) => (
      <TouchableOpacity
        style={styles.searchResultItem}
        onPress={() => handleSelectAddress(item)}>
        <View style={styles.searchResultIcon}>
          <IconSymbol name="mappin.circle.fill" size={24} color="#5170FF" />
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
    [handleSelectAddress]
  );

  if (!visible) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.handleIndicator}>
      <BottomSheetView style={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <IconSymbol name="magnifyingglass" size={20} color="#666" style={styles.searchIcon} />
            <BottomSheetTextInput
              style={styles.searchInput}
              placeholder="Adresse suchen..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                <IconSymbol name="xmark.circle.fill" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Use Current Location */}
        {showCurrentLocation && (
          <TouchableOpacity
            style={styles.currentLocationButton}
            onPress={handleUseCurrentLocation}
            disabled={isSearching}>
            <IconSymbol name="location.fill" size={20} color="#FF3B30" />
            <Text style={styles.currentLocationText}>Aktuelle Position verwenden</Text>
            <IconSymbol name="chevron.right" size={16} color="#999" />
          </TouchableOpacity>
        )}

        {/* Search Results or Selected Address */}
        {isSearching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#5170FF" />
            <Text style={styles.loadingText}>Suche...</Text>
          </View>
        ) : selectedAddress && searchResults.length === 0 ? (
          <View style={styles.selectedAddressContainer}>
            <View style={styles.selectedAddressCard}>
              <View style={styles.selectedAddressIcon}>
                <IconSymbol name="checkmark.circle.fill" size={24} color="#34C759" />
              </View>
              <View style={styles.selectedAddressContent}>
                <Text style={styles.selectedAddressLabel}>Ausgewählte Adresse</Text>
                <Text style={styles.selectedAddressText}>{selectedAddress.formattedAddress}</Text>
              </View>
            </View>
          </View>
        ) : searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item, index) => `${item.latitude}-${item.longitude}-${index}`}
            style={styles.resultsList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        ) : searchQuery.length > 0 && searchQuery.length < 2 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Bitte geben Sie mindestens 2 Zeichen ein</Text>
          </View>
        ) : null}

        {/* Confirm Button */}
        {selectedAddress && (
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmButtonText}>Adresse verwenden</Text>
          </TouchableOpacity>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleIndicator: {
    backgroundColor: '#ccc',
    width: 40,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
  },
  searchIcon: {
    marginRight: 8,
    alignSelf: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  currentLocationText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FF3B30',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  resultsList: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultIcon: {
    marginRight: 12,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  searchResultAddress: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  selectedAddressContainer: {
    marginBottom: 20,
  },
  selectedAddressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#34C759',
  },
  selectedAddressIcon: {
    marginRight: 12,
  },
  selectedAddressContent: {
    flex: 1,
  },
  selectedAddressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34C759',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  selectedAddressText: {
    fontSize: 16,
    color: '#000',
    lineHeight: 22,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: '#5170FF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

