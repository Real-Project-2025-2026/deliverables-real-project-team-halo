import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { checkUsernameAvailability, validateUsernameFormat } from '@/services/username-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  image: any;
  title: string;
  description: string;
}

const slides: OnboardingSlide[] = [
  {
    id: '1',
    image: require('@/assets/images/onbarding-1.png'),
    title: 'Your Digital Guardian',
    description:
      'Halo provides peace of mind while walking home or moving alone. Stay connected and protected.',
  },
  {
    id: '2',
    image: require('@/assets/images/onbarding-2.png'),
    title: 'Smart Check-ins',
    description:
      'Regular "Are you okay?" notifications keep you safe. Choose your check-in frequency and safety mode.',
  },
  {
    id: '3',
    image: require('@/assets/images/onbarding-3.png'),
    title: 'SafeTogether',
    description:
      'Connect with verified nearby Halo users. Walk home together and notify your trusted contacts.',
  },
];

export default function OnboardingScreen() {
  const { user, profile, session, isLoading, refreshProfile } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userName, setUserName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  // Default to showing username input - will be hidden if user already has username
  const [showUsernameInput, setShowUsernameInput] = useState(true);
  const [usernameCompleted, setUsernameCompleted] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // If no session and not loading, redirect to login
    if (!isLoading && !session) {
      console.log('[Onboarding] No session - redirecting to login');
      router.replace('/(auth)/login');
      return;
    }

    // Skip all checks if we're currently setting username
    if (isCheckingUsername) {
      return;
    }

    // If user already has username and session, redirect to tabs
    if (!isLoading && session && profile?.username) {
      console.log('[Onboarding] User already has username - redirecting to tabs');
      router.replace('/(tabs)');
      return;
    }

    // If no session after loading, redirect to login (prevents infinite loop)
    if (!isLoading && !session) {
      console.log('[Onboarding] No session after loading - redirecting to login');
      router.replace('/(auth)/login');
      return;
    }

    loadUserName();
    // After sign-up, user ALWAYS needs to set username
    // Only check if user already has username (for users coming back to onboarding)
    if (session && user) {
      checkExistingUsername();
    }
  }, [user, profile, session, isLoading, isCheckingUsername]);

  async function checkExistingUsername() {
    // After sign-up, user NEVER has a username yet - so always show username input
    // Only skip username input if user already completed onboarding before (very rare case)
    
    // Check if user already has username (only possible if they already completed onboarding)
    if (profile?.username && profile.username.trim().length > 0) {
      console.log('[Onboarding] User already has username, skipping to slides');
      setUsernameCompleted(true);
      setShowUsernameInput(false);
      return;
    }

    // Default: Show username input (all new sign-ups need this)
    // This will be the case 99% of the time
    console.log('[Onboarding] New user or no username - showing username input');
    setShowUsernameInput(true);
    setUsernameCompleted(false);
    
    // Optional: Double-check from database (but shouldn't be necessary)
    if (user && !profile) {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      
      if (data?.username && data.username.trim().length > 0) {
        // Very rare: User already has username (already completed onboarding)
        console.log('[Onboarding] User already has username in database, skipping to slides');
        setUsernameCompleted(true);
        setShowUsernameInput(false);
      }
    }
  }

  async function loadUserName() {
    try {
      const name = await AsyncStorage.getItem('@halo_onboarding_name');
      if (name) {
        setUserName(name);
        // Don't remove from AsyncStorage here - AuthProvider will clear it after creating profile
      }
    } catch (error) {
      console.error('Error loading user name:', error);
    }
  }

  async function handleUsernameNext() {
    if (!username.trim()) {
      setUsernameError('Username is required');
      return;
    }

    const validation = validateUsernameFormat(username);
    if (!validation.isValid) {
      setUsernameError(validation.error || 'Invalid username');
      return;
    }

    setIsCheckingUsername(true);
    setUsernameError('');

    try {
      // Check availability
      const availability = await checkUsernameAvailability(username);
      if (!availability.available) {
        setUsernameError(availability.error || 'Username is not available');
        setIsCheckingUsername(false);
        return;
      }

      // Update username
      if (user) {
        console.log('[Onboarding] User ID before updateUsername:', user.id);
        console.log('[Onboarding] Username to set:', username.trim().toLowerCase());
        
        // Verify session is active
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('[Onboarding] Session check:', { 
          hasSession: !!session, 
          sessionUserId: session?.user?.id,
          matchesUser: session?.user?.id === user.id,
          sessionError 
        });
        
        if (!session || session.user.id !== user.id) {
          console.error('[Onboarding] Session mismatch or missing');
          setUsernameError('Session error. Please try again.');
          setIsCheckingUsername(false);
          return;
        }
        
        // Check if profile exists, if not create it first
        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();
        
        if (profileError && profileError.code === 'PGRST116') {
          console.log('[Onboarding] Profile does not exist, creating it with RPC function...');
          
          // Profile doesn't exist - use RPC function to create it safely
          const fullName = await AsyncStorage.getItem('@halo_onboarding_name');
          
          const { data: newProfile, error: createError } = await supabase
            .rpc('upsert_profile', {
              p_user_id: user.id,
              p_username: username.trim().toLowerCase(),
              p_full_name: fullName?.trim() || null,
            });
          
          if (createError) {
            console.error('[Onboarding] Error creating profile via RPC:', createError);
            setUsernameError('Failed to create profile. Please try again.');
            setIsCheckingUsername(false);
            return;
          }
          
          console.log('[Onboarding] ✅ Profile created with username via RPC:', newProfile);
          
          // Clear AsyncStorage after successful creation
          if (fullName) {
            await AsyncStorage.removeItem('@halo_onboarding_name');
          }
          
          // Wait a moment for the profile to be updated in the database
          await new Promise((resolve) => setTimeout(resolve, 300));
          
          // Navigate to tabs now that profile is created
          router.replace('/(tabs)');
          return; // Exit early - navigation handled
        } else if (profileError) {
          console.error('[Onboarding] Error checking profile:', profileError);
          setUsernameError('Profile error. Please try again.');
          setIsCheckingUsername(false);
          return;
        } else {
          // Profile exists - use RPC function to update username safely
          console.log('[Onboarding] Profile exists, updating username via RPC...');
          
          const { data: updatedProfile, error: updateError } = await supabase
            .rpc('upsert_profile', {
              p_user_id: user.id,
              p_username: username.trim().toLowerCase(),
              p_full_name: null, // Don't update full_name, just username
            });
          
          if (updateError) {
            console.error('[Onboarding] Error updating username via RPC:', updateError);
            setUsernameError('Failed to update username. Please try again.');
            setIsCheckingUsername(false);
            return;
          }
          
          console.log('[Onboarding] ✅ Username updated via RPC:', updatedProfile);
        }
      } else {
        console.error('[Onboarding] No user available for username update');
        setUsernameError('User not found. Please try again.');
        setIsCheckingUsername(false);
        return;
      }

      // Username set successfully
      setUsernameCompleted(true);
      setShowUsernameInput(false);
      
      // Wait a moment for profile to be saved
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Force refresh profile by reloading it from database
      // This ensures the profile has the username before navigation
      const { data: refreshedProfile, error: refreshError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      
      if (refreshError) {
        console.error('[Onboarding] Error refreshing profile:', refreshError);
      } else {
        console.log('[Onboarding] ✅ Profile refreshed, username:', refreshedProfile?.username);
        
        // Verify username was saved
        if (!refreshedProfile?.username) {
          console.error('[Onboarding] ⚠️ Username not found in refreshed profile!');
          setUsernameError('Username was not saved. Please try again.');
          setIsCheckingUsername(false);
          return;
        }
      }
      
      // Force AuthProvider to reload profile and wait for it to complete
      if (refreshProfile) {
        console.log('[Onboarding] Refreshing profile in AuthProvider...');
        await refreshProfile();
        
        // Wait a bit more for state to update
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      
      // Double-check that profile has username before navigating
      const { data: finalCheck, error: checkError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      
      if (checkError || !finalCheck?.username) {
        console.error('[Onboarding] ❌ Username still not in profile after refresh!', checkError);
        setUsernameError('Username was not saved correctly. Please try again.');
        setIsCheckingUsername(false);
        return;
      }
      
      console.log('[Onboarding] ✅ Final check passed, username confirmed:', finalCheck.username);
      
      // Wait a moment more to ensure AuthProvider state is updated
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Now navigate to tabs - profile definitely has username
      console.log('[Onboarding] Navigating to tabs...');
      setIsCheckingUsername(false); // Reset before navigation
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Error setting username:', error);
      setUsernameError(error.message || 'Failed to set username');
    } finally {
      setIsCheckingUsername(false);
    }
  }

  async function handleGetStarted() {
    try {
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error navigating to app:', error);
    }
  }

  function handleSkip() {
    handleGetStarted();
  }

  function handleNext() {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleGetStarted();
    }
  }

  function onViewableItemsChanged({
    viewableItems,
  }: {
    viewableItems: ViewToken[];
  }) {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }

  function renderSlide({ item }: { item: OnboardingSlide }) {
    return (
      <View style={styles.slide}>
        <View style={styles.imageContainer}>
          <Image
            source={item.image}
            style={styles.slideImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    );
  }

  const isLastSlide = currentIndex === slides.length - 1;

  // Debug logging
  console.log('[Onboarding] Render state:', {
    showUsernameInput,
    usernameCompleted,
    hasUser: !!user,
    userName,
  });

  // Show username input screen first if user needs to set username
  // Always show if showUsernameInput is true, unless username is already completed
  if (showUsernameInput && !usernameCompleted) {
    console.log('[Onboarding] Rendering username input screen');
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          <View style={styles.usernameContainer}>
            {userName && (
              <View style={styles.welcomeHeader}>
                <Text style={styles.welcomeText}>Welcome, {userName}! 👋</Text>
                <Text style={styles.welcomeSubtext}>Choose your username</Text>
              </View>
            )}

            <View style={styles.usernameForm}>
              <Text style={styles.usernameLabel}>Username</Text>
              <Text style={styles.usernameHint}>
                3-20 characters, letters, numbers, and underscores only
              </Text>
              
              <View style={styles.usernameInputContainer}>
                <Text style={styles.usernamePrefix}>@</Text>
                <TextInput
                  style={[
                    styles.usernameInput,
                    usernameError && styles.usernameInputError,
                  ]}
                  placeholder="username"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                    setUsernameError('');
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  editable={!isCheckingUsername}
                  maxLength={20}
                />
              </View>

              {usernameError ? (
                <Text style={styles.errorText}>{usernameError}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.usernameButton,
                  (!username.trim() || isCheckingUsername) && styles.usernameButtonDisabled,
                ]}
                onPress={handleUsernameNext}
                disabled={!username.trim() || isCheckingUsername}>
                {isCheckingUsername ? (
                  <ActivityIndicator color="#5170FF" />
                ) : (
                  <>
                    <Text style={styles.usernameButtonText}>Continue</Text>
                    <IconSymbol name="arrow.right" size={20} color="#5170FF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  console.log('[Onboarding] Rendering onboarding slides');

  return (
    <SafeAreaView style={styles.container}>
      {/* Welcome Header */}
      {userName && (
        <View style={styles.welcomeHeader}>
          <Text style={styles.welcomeText}>Welcome, {userName}! 👋</Text>
          <Text style={styles.welcomeSubtext}>Let's show you around</Text>
        </View>
      )}

      {/* Skip Button */}
      {!isLastSlide && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50,
        }}
        keyExtractor={(item) => item.id}
      />

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === currentIndex && styles.activeDot]}
            />
          ))}
        </View>

        {/* Next/Get Started Button */}
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {isLastSlide ? 'Get Started' : 'Next'}
          </Text>
          <IconSymbol
            name={isLastSlide ? 'arrow.right.circle.fill' : 'arrow.right'}
            size={24}
            color="#5170FF"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5170FF',
  },
  welcomeHeader: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  skipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  slide: {
    width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  imageContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.9,
  },
  bottomSection: {
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  activeDot: {
    width: 24,
    backgroundColor: '#fff',
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    color: '#5170FF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  keyboardView: {
    flex: 1,
  },
  usernameContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  usernameForm: {
    gap: 16,
  },
  usernameLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  usernameHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  usernameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    height: 56,
  },
  usernamePrefix: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginRight: 4,
  },
  usernameInput: {
    flex: 1,
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
  },
  usernameInputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginTop: -8,
  },
  usernameButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  usernameButtonDisabled: {
    opacity: 0.6,
  },
  usernameButtonText: {
    color: '#5170FF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
