import { IconSymbol } from '@/components/ui/icon-symbol';
import { useGuardian } from '@/hooks/use-guardian';
import { useGuardianTrips } from '@/hooks/use-guardian-trips';
import { useAuth } from '@/providers/auth-provider';
import type { GuardianWithProfile, PublicUserProfile } from '@/services/guardian-service';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

type TabType = 'guardians' | 'search' | 'requests';

export default function SafeTogetherScreen() {
  const { user, profile } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();
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

  // Guardian Trips (active trips where user is a Guardian)
  const {
    guardianTrips,
    isLoading: isLoadingTrips,
    refresh: refreshTrips,
  } = useGuardianTrips();


  // Initialize activeTab from URL params or default
  const [activeTab, setActiveTab] = useState<TabType>(
    (params?.tab as TabType) || 'guardians'
  );

  // Update tab when URL params change (for notification navigation)
  useEffect(() => {
    if (params?.tab && ['guardians', 'search', 'requests'].includes(params.tab)) {
      setActiveTab(params.tab as TabType);
    }
  }, [params?.tab]);

  // Sync scroll position with active tab
  useEffect(() => {
    const tabIndex = ['guardians', 'search', 'requests'].indexOf(activeTab);
    if (tabIndex >= 0 && scrollViewRef.current) {
      const screenWidth = Dimensions.get('window').width;
      scrollViewRef.current.scrollTo({
        x: tabIndex * screenWidth,
        animated: true,
      });
    }
  }, [activeTab]);

  // Handle scroll end to update active tab
  const handleScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const screenWidth = event.nativeEvent.layoutMeasurement.width;
    const tabIndex = Math.round(offsetX / screenWidth);
    const tabs: TabType[] = ['guardians', 'search', 'requests'];
    if (tabs[tabIndex] && tabs[tabIndex] !== activeTab) {
      setActiveTab(tabs[tabIndex]);
    }
  }, [activeTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Search with debounce
  const performSearch = useCallback(
    async (query: string) => {
      if (!query || query.trim().length < 3) {
        setSearchResults([]);
        return;
      }

      console.log('[Explore Screen] Performing search for:', query);
      setIsSearching(true);
      try {
        const results = await searchUsersHook(query);
        console.log('[Explore Screen] Search results:', results.length, results.map(r => r.username));
        setSearchResults(results);
      } catch (err) {
        console.error('[Explore Screen] Search error:', err);
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
        // Refresh to update UI
        await refresh();
      } else {
        Alert.alert('Error', error || 'Failed to send request');
      }
    },
    [sendRequest, error, refresh]
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

  // Render user avatar (for header)
  const renderUserAvatar = useCallback(() => {
    const firstLetter = (profile?.username || profile?.full_name || user?.email || '?')[0].toUpperCase();
    const avatarUrl = profile?.avatar_url;

    if (avatarUrl) {
      return (
        <Image
          source={{ uri: avatarUrl }}
          style={styles.userAvatarImage}
          contentFit="cover"
          transition={200}
        />
      );
    }

    return (
      <View style={[styles.userAvatarContainer, styles.userAvatarPlaceholder]}>
        <Text style={styles.userAvatarText}>{firstLetter}</Text>
      </View>
    );
  }, [profile, user]);

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

  // Render Guardian Trip item
  const renderGuardianTrip = useCallback(
    ({ item }: { item: import('@/hooks/use-guardian-trips').GuardianTrip }) => {
      const displayName = item.user_profile.full_name || item.user_profile.username || 'Unknown';
      const elapsedSeconds = Math.floor(
        (Date.now() - new Date(item.started_at).getTime()) / 1000
      );
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      const elapsedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      const isEscalated = item.status === 'escalated';

      return (
        <TouchableOpacity
          style={styles.tripCard}
          onPress={() => router.push(`/guardian-trip/${item.id}`)}>
          <View style={styles.tripHeader}>
            {renderAvatar(item.user_profile)}
            <View style={styles.tripInfo}>
              <Text style={styles.tripUserName}>
                @{item.user_profile.username || 'unknown'}
              </Text>
              {item.user_profile.full_name && (
                <Text style={styles.tripFullName}>{displayName}</Text>
              )}
            </View>
            <View
              style={[
                styles.tripStatusBadge,
                isEscalated && styles.tripStatusBadgeEscalated,
              ]}>
              <IconSymbol
                name={isEscalated ? 'exclamationmark.triangle.fill' : 'circle.fill'}
                size={8}
                color={isEscalated ? '#FF3B30' : '#34C759'}
              />
              <Text style={[styles.tripStatusText, isEscalated && styles.tripStatusTextEscalated]}>
                {isEscalated ? 'Emergency' : 'Active'}
              </Text>
            </View>
          </View>
          <View style={styles.tripStats}>
            <View style={styles.tripStatItem}>
              <IconSymbol name="clock.fill" size={14} color="#666" />
              <Text style={styles.tripStatText}>{elapsedTime}</Text>
            </View>
            {item.mode !== 'silent' && (
              <View style={styles.tripStatItem}>
                <IconSymbol name="bell.fill" size={14} color="#666" />
                <Text style={styles.tripStatText}>
                  {item.checkin_interval_minutes}min
                </Text>
              </View>
            )}
            {isEscalated && item.missed_checkins_count && item.missed_checkins_count > 0 && (
              <View style={[styles.tripStatItem, styles.tripStatItemWarning]}>
                <IconSymbol
                  name="exclamationmark.triangle.fill"
                  size={14}
                  color="#FF3B30"
                />
                <Text style={[styles.tripStatText, styles.tripStatTextWarning]}>
                  {item.missed_checkins_count} missed
                </Text>
              </View>
            )}
          </View>
          <View style={styles.tripFooter}>
            <IconSymbol name="chevron.right" size={16} color="#999" />
          </View>
        </TouchableOpacity>
      );
    },
    [renderAvatar]
  );

  // Render Guardian item with swipe-to-delete
  const renderGuardian = useCallback(
    ({ item }: { item: GuardianWithProfile }) => {
      const otherUser = getOtherUser(item);
      const displayName = otherUser.full_name || otherUser.username || 'Unknown';
      let swipeableRef: Swipeable | null = null;

      const renderRightActions = () => (
        <View style={styles.deleteActionContainer}>
          <TouchableOpacity
            style={styles.deleteAction}
            onPress={async () => {
              swipeableRef?.close();
              await handleRemoveGuardian(item.id, otherUser.username || 'user');
            }}>
            <Text style={styles.deleteActionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      );

      return (
        <Swipeable
          ref={(ref) => {
            swipeableRef = ref;
          }}
          renderRightActions={renderRightActions}
          overshootRight={false}
          friction={2}>
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
          </View>
        </Swipeable>
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
          <View style={styles.statusBadgePending}>
            <Text style={styles.statusTextPending}>Pending</Text>
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
            <IconSymbol name="person.badge.plus" size={16} color="#5170FF" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        );
      }

      return (
        <View style={styles.searchCard}>
          {renderAvatar(item)}
          <View style={styles.searchInfo}>
            <Text style={styles.searchUsername}>
              {item.username ? `@${item.username}` : item.full_name || 'Unknown User'}
            </Text>
            {item.full_name && item.username && (
              <Text style={styles.searchName}>{item.full_name}</Text>
            )}
            {!item.username && !item.full_name && (
              <Text style={styles.searchName}>No profile set up yet</Text>
            )}
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
              <IconSymbol name="checkmark.circle.fill" size={28} color="#34C759" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineButtonSmall}
              onPress={() => handleDeclineRequest(item.id)}>
              <IconSymbol name="xmark.circle.fill" size={28} color="#FF3B30" />
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
      <IconSymbol name="person.2.fill" size={64} color="#ccc" />
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
      <IconSymbol name="magnifyingglass" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>Search for users</Text>
      <Text style={styles.emptyText}>
        Type at least 3 characters to search for users by username or email.
      </Text>
    </View>
  );

  const renderEmptyRequests = () => (
    <View style={styles.emptyState}>
      <IconSymbol name="bell.fill" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No pending requests</Text>
      <Text style={styles.emptyText}>You don't have any pending Guardian requests.</Text>
    </View>
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>SafeTogether</Text>
        <View style={styles.headerRight}>
          {pendingRequests.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingRequests.length}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.userAvatarContainer}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}>
            {renderUserAvatar()}
          </TouchableOpacity>
        </View>
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

      {/* Content with Swipe Support */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.contentScrollView}
        contentContainerStyle={styles.contentScrollViewContent}>
        {/* Guardians Tab */}
        <View style={styles.tabContent}>
          <View style={styles.guardiansContent}>
            {/* Active Guardian Trips Section */}
            {guardianTrips.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Active Trips</Text>
                <FlatList
                  data={guardianTrips}
                  renderItem={renderGuardianTrip}
                  keyExtractor={(item) => `trip-${item.id}`}
                  contentContainerStyle={styles.tripsListContent}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                />
              </View>
            )}

            {/* Guardians List */}
            <View style={styles.section}>
              <FlatList
                data={guardians}
                renderItem={renderGuardian}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={[
                  styles.listContent,
                  guardians.length === 0 && styles.listContentEmpty,
                ]}
                ListEmptyComponent={renderEmptyGuardians}
                removeClippedSubviews={false}
                maintainVisibleContentPosition={{
                  minIndexForVisible: 0,
                }}
                refreshControl={
                  <RefreshControl
                    refreshing={isLoading}
                    onRefresh={() => {
                      refresh();
                      refreshTrips();
                    }}
                    tintColor="#666"
                  />
                }
              />
            </View>
          </View>
        </View>

        {/* Search Tab */}
        <View style={styles.tabContent}>
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <IconSymbol name="magnifyingglass" size={20} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by username or email..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              {isSearching && <ActivityIndicator size="small" color="#666" />}
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
                        <IconSymbol name="magnifyingglass" size={64} color="#ccc" />
                        <Text style={styles.emptyTitle}>Search for friends</Text>
                        <Text style={styles.emptyText}>
                          Type at least 3 characters to search for users by username or email.
                        </Text>
                      </View>
                    )
              }
            />
          </View>
        </View>

        {/* Requests Tab */}
        <View style={styles.tabContent}>
          <FlatList
            data={pendingRequests}
            renderItem={renderPendingRequest}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={renderEmptyRequests}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#666" />}
          />
        </View>
      </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  userAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userAvatarPlaceholder: {
    backgroundColor: '#5170FF',
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
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
    backgroundColor: '#fff',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tabActive: {
    backgroundColor: '#5170FF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
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
  contentScrollView: {
    flex: 1,
  },
  contentScrollViewContent: {
    flexDirection: 'row',
  },
  tabContent: {
    width: Dimensions.get('window').width,
    flex: 1,
  },
  searchContainer: {
    flex: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginHorizontal: 24,
    marginBottom: 16,
    height: 50,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  guardiansContent: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    paddingHorizontal: 24,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tripsListContent: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  tripCard: {
    width: 280,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripInfo: {
    flex: 1,
    marginLeft: 12,
  },
  tripUserName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  tripFullName: {
    fontSize: 13,
    color: '#666',
  },
  tripStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  tripStatusBadgeEscalated: {
    backgroundColor: '#FFEBEE',
  },
  tripStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34C759',
  },
  tripStatusTextEscalated: {
    color: '#FF3B30',
  },
  tripStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  tripStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripStatItemWarning: {
    gap: 4,
  },
  tripStatText: {
    fontSize: 12,
    color: '#666',
  },
  tripStatTextWarning: {
    color: '#FF3B30',
  },
  tripFooter: {
    alignItems: 'flex-end',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexGrow: 1,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  guardianCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  guardianInfo: {
    flex: 1,
    marginLeft: 12,
  },
  guardianUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  guardianName: {
    fontSize: 14,
    color: '#666',
  },
  deleteActionContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 24,
  },
  deleteAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: 12,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  searchName: {
    fontSize: 14,
    color: '#666',
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  requestInfo: {
    flex: 1,
    marginLeft: 12,
  },
  requestUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  requestName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  requestTime: {
    fontSize: 12,
    color: '#999',
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
    backgroundColor: '#5170FF',
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
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  statusBadgePending: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusTextPending: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5170FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  acceptButton: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#34C759',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
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
    color: '#000',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: '#5170FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
