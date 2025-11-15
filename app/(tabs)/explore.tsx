import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '@/providers/auth-provider';
import { useGuardian } from '@/hooks/use-guardian';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { GuardianWithProfile, PublicUserProfile } from '@/services/guardian-service';
import * as guardianService from '@/services/guardian-service';

type TabType = 'guardians' | 'search' | 'requests';

export default function SafeTogetherScreen() {
  const { user } = useAuth();
  const {
    guardians,
    pendingRequests,
    sentRequests,
    isLoading,
    error,
    searchUsers: searchUsersHook,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeGuardian,
    refresh,
  } = useGuardian();

  const [activeTab, setActiveTab] = useState<TabType>('guardians');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search with debounce
  const performSearch = useCallback(
    async (query: string) => {
      if (!query || query.trim().length < 3) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchUsersHook(query);
        setSearchResults(results);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    },
    [searchUsersHook]
  );

  // Debounce search when query changes
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, 500);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleSendRequest = useCallback(
    async (recipientId: string, username: string) => {
      const success = await sendRequest(recipientId);
      if (success) {
        Alert.alert('Request Sent', `Guardian request sent to @${username}`);
      } else {
        Alert.alert('Error', error || 'Failed to send request');
      }
    },
    [sendRequest, error]
  );

  const handleAcceptRequest = useCallback(
    async (requestId: number, username: string) => {
      const success = await acceptRequest(requestId);
      if (success) {
        Alert.alert('Guardian Added', `@${username} is now your Guardian! 🎉`);
        setActiveTab('guardians');
      } else {
        Alert.alert('Error', error || 'Failed to accept request');
      }
    },
    [acceptRequest, error]
  );

  const handleDeclineRequest = useCallback(
    async (requestId: number) => {
      Alert.alert('Decline Request', 'Are you sure you want to decline this request?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            const success = await declineRequest(requestId);
            if (!success) {
              Alert.alert('Error', error || 'Failed to decline request');
            }
          },
        },
      ]);
    },
    [declineRequest, error]
  );

  const handleRemoveGuardian = useCallback(
    async (guardianId: number, username: string) => {
      Alert.alert('Remove Guardian', `Are you sure you want to remove @${username}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const success = await removeGuardian(guardianId);
            if (!success) {
              Alert.alert('Error', error || 'Failed to remove Guardian');
            }
          },
        },
      ]);
    },
    [removeGuardian, error]
  );

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
            style={styles.avatar}
            contentFit="cover"
            transition={200}
          />
        );
      }

      return (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarText}>{firstLetter}</Text>
        </View>
      );
    },
    []
  );

  // Render Guardian item
  const renderGuardian = useCallback(
    ({ item }: { item: GuardianWithProfile }) => {
      const otherUser = getOtherUser(item);
      const displayName = otherUser.full_name || otherUser.username || 'Unknown';

      return (
        <View style={styles.guardianCard}>
          {renderAvatar(otherUser)}
          <View style={styles.guardianInfo}>
            <Text style={styles.guardianUsername}>
              @{otherUser.username || 'unknown'}
            </Text>
            {otherUser.full_name && (
              <Text style={styles.guardianName}>{displayName}</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveGuardian(item.id, otherUser.username || 'user')}>
            <IconSymbol name="xmark.circle.fill" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      );
    },
    [getOtherUser, renderAvatar, handleRemoveGuardian]
  );

  // Render search result
  const renderSearchResult = useCallback(
    ({ item }: { item: PublicUserProfile }) => {
      // Check if user already has relationship with this user
      const existingGuardian = guardians.find(
        (g) =>
          (g.requester_id === user?.id && g.recipient_id === item.id) ||
          (g.recipient_id === user?.id && g.requester_id === item.id)
      );

      const existingSentRequest = sentRequests.find((r) => r.recipient_id === item.id);
      const existingPendingRequest = pendingRequests.find((r) => r.requester_id === item.id);

      let actionButton = null;
      if (existingGuardian?.status === 'accepted') {
        actionButton = (
          <View style={styles.statusBadge}>
            <IconSymbol name="checkmark.circle.fill" size={16} color="#34C759" />
            <Text style={styles.statusText}>Guardian</Text>
          </View>
        );
      } else if (existingSentRequest) {
        actionButton = (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Pending</Text>
          </View>
        );
      } else if (existingPendingRequest) {
        actionButton = (
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAcceptRequest(existingPendingRequest.id, item.username || 'user')}>
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
        );
      } else {
        actionButton = (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleSendRequest(item.id, item.username || 'user')}>
            <IconSymbol name="person.badge.plus" size={16} color="#fff" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        );
      }

      return (
        <View style={styles.searchCard}>
          {renderAvatar(item)}
          <View style={styles.searchInfo}>
            <Text style={styles.searchUsername}>@{item.username || 'unknown'}</Text>
            {item.full_name && <Text style={styles.searchName}>{item.full_name}</Text>}
          </View>
          {actionButton}
        </View>
      );
    },
    [
      guardians,
      sentRequests,
      pendingRequests,
      user,
      renderAvatar,
      handleSendRequest,
      handleAcceptRequest,
    ]
  );

  // Render pending request
  const renderPendingRequest = useCallback(
    ({ item }: { item: GuardianWithProfile }) => {
      const requester = item.requester_profile;
      const displayName = requester.full_name || requester.username || 'Unknown';

      return (
        <View style={styles.requestCard}>
          {renderAvatar(requester)}
          <View style={styles.requestInfo}>
            <Text style={styles.requestUsername}>@{requester.username || 'unknown'}</Text>
            {requester.full_name && <Text style={styles.requestName}>{displayName}</Text>}
            <Text style={styles.requestTime}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={styles.acceptButtonSmall}
              onPress={() => handleAcceptRequest(item.id, requester.username || 'user')}>
              <IconSymbol name="checkmark.circle.fill" size={20} color="#34C759" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineButtonSmall}
              onPress={() => handleDeclineRequest(item.id)}>
              <IconSymbol name="xmark.circle.fill" size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [renderAvatar, handleAcceptRequest, handleDeclineRequest]
  );

  // Empty states
  const renderEmptyGuardians = () => (
    <View style={styles.emptyState}>
      <IconSymbol name="person.2.fill" size={64} color="rgba(255, 255, 255, 0.3)" />
      <Text style={styles.emptyTitle}>No Guardians yet</Text>
      <Text style={styles.emptyText}>
        Search for friends and add them as Guardians to stay connected during trips.
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => setActiveTab('search')}>
        <Text style={styles.emptyButtonText}>Search Friends</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptySearch = () => (
    <View style={styles.emptyState}>
      <IconSymbol name="magnifyingglass" size={64} color="rgba(255, 255, 255, 0.3)" />
      <Text style={styles.emptyTitle}>Search for users</Text>
      <Text style={styles.emptyText}>
        Type at least 3 characters to search for users by username.
      </Text>
    </View>
  );

  const renderEmptyRequests = () => (
    <View style={styles.emptyState}>
      <IconSymbol name="bell.fill" size={64} color="rgba(255, 255, 255, 0.3)" />
      <Text style={styles.emptyTitle}>No pending requests</Text>
      <Text style={styles.emptyText}>You don't have any pending Guardian requests.</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Guardians</Text>
        {pendingRequests.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingRequests.length}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'guardians' && styles.tabActive]}
          onPress={() => setActiveTab('guardians')}>
          <Text style={[styles.tabText, activeTab === 'guardians' && styles.tabTextActive]}>
            Guardians
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'search' && styles.tabActive]}
          onPress={() => setActiveTab('search')}>
          <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
            Search
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
          onPress={() => setActiveTab('requests')}>
          <View style={styles.tabWithBadge}>
            <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
              Requests
            </Text>
            {pendingRequests.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pendingRequests.length}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'guardians' && (
        <FlatList
          data={guardians}
          renderItem={renderGuardian}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyGuardians}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#fff" />}
        />
      )}

      {activeTab === 'search' && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <IconSymbol name="magnifyingglass" size={20} color="rgba(255, 255, 255, 0.6)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by username..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isSearching && <ActivityIndicator size="small" color="#fff" />}
          </View>

          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              searchQuery.length >= 3
                ? renderEmptySearch
                : () => (
                    <View style={styles.emptyState}>
                      <IconSymbol name="magnifyingglass" size={64} color="rgba(255, 255, 255, 0.3)" />
                      <Text style={styles.emptyTitle}>Search for friends</Text>
                      <Text style={styles.emptyText}>
                        Type at least 3 characters to search for users by username.
                      </Text>
                    </View>
                  )
            }
          />
        </View>
      )}

      {activeTab === 'requests' && (
        <FlatList
          data={pendingRequests}
          renderItem={renderPendingRequest}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyRequests}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#fff" />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5170FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  searchContainer: {
    flex: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginHorizontal: 24,
    marginBottom: 16,
    height: 50,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  guardianCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  guardianInfo: {
    flex: 1,
    marginLeft: 12,
  },
  guardianUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  guardianName: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  removeButton: {
    padding: 4,
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  searchInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  searchName: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  requestInfo: {
    flex: 1,
    marginLeft: 12,
  },
  requestUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  requestName: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  requestTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5170FF',
  },
  acceptButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#34C759',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  acceptButtonSmall: {
    padding: 4,
  },
  declineButtonSmall: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5170FF',
  },
});
