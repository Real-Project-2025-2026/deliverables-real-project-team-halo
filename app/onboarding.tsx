import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  ViewToken,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/providers/auth-provider';
import { checkUsernameAvailability, updateUsername, validateUsernameFormat } from '@/services/username-service';
import { supabase } from '@/lib/supabase';

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
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userName, setUserName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [showUsernameInput, setShowUsernameInput] = useState(false);
  const [usernameCompleted, setUsernameCompleted] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadUserName();
    // Check if user already has a username
    checkExistingUsername();
  }, [user]);

  async function checkExistingUsername() {
    if (user) {
      // Check if user already has username set
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      
      if (data?.username) {
        // User already has username, skip to slides
        setUsernameCompleted(true);
        setShowUsernameInput(false);
      } else {
        // Show username input
        setShowUsernameInput(true);
      }
    }
  }

  async function loadUserName() {
    try {
      const name = await AsyncStorage.getItem('@halo_onboarding_name');
      if (name) {
        setUserName(name);
        await AsyncStorage.removeItem('@halo_onboarding_name');
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
        const result = await updateUsername(user.id, username);
        if (!result.success) {
          setUsernameError(result.error || 'Failed to set username');
          setIsCheckingUsername(false);
          return;
        }
      }

      // Username set successfully, proceed to slides
      setUsernameCompleted(true);
      setShowUsernameInput(false);
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

  // Show username input screen first
  if (showUsernameInput && !usernameCompleted) {
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
