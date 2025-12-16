import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image } from 'expo-image';
import { checkUsernameAvailability, validateUsernameFormat } from '@/services/username-service';

export default function OnboardingUsernameScreen() {
  const { user, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleContinue() {
    if (!username.trim()) {
      setUsernameError('Username is required');
      return;
    }

    const validation = validateUsernameFormat(username);
    if (!validation.isValid) {
      setUsernameError(validation.error || 'Invalid username');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User not found. Please log in again.');
      router.replace('/(auth)/login');
      return;
    }

    setIsLoading(true);
    setUsernameError('');

    try {
      // Check availability
      const availability = await checkUsernameAvailability(username);
      if (!availability.available) {
        setUsernameError(availability.error || 'Username is not available');
        setIsLoading(false);
        return;
      }

      // Try UPDATE first (profile should exist from name step)
      console.log('[OnboardingUsername] Attempting to update username...');
      const { data: updateData, error: updateError } = await supabase
        .from('profiles')
        .update({
          username: username.trim().toLowerCase(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      let data = updateData;
      let error = updateError;

      if (updateError || !updateData) {
        // Update failed - try INSERT as fallback
        console.log('[OnboardingUsername] Update failed, trying INSERT...');
        const { data: insertData, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            username: username.trim().toLowerCase(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        data = insertData;
        error = insertError;
      }

      if (error) {
        console.error('[OnboardingUsername] Error saving username:', error);
        
        if (error.code === '23505') {
          setUsernameError('Username is already taken');
        } else {
          setUsernameError('Failed to save username. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      console.log('[OnboardingUsername] ✅ Username saved:', data);

      // Wait a moment for profile to be saved
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify username was saved
      const { data: verifyData, error: verifyError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      if (verifyError || !verifyData?.username) {
        console.error('[OnboardingUsername] ⚠️ Username not found after save!', verifyError);
        setUsernameError('Username was not saved. Please try again.');
        setIsLoading(false);
        return;
      }

      console.log('[OnboardingUsername] ✅ Username verified:', verifyData.username);

      // Refresh profile in AuthProvider
      if (refreshProfile) {
        await refreshProfile();
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Navigate to main app
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('[OnboardingUsername] Error:', error);
      setUsernameError(error.message || 'Failed to save username');
    } finally {
      setIsLoading(false);
    }
  }

  function handleUsernameChange(text: string) {
    // Auto-lowercase and remove invalid characters
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);
    setUsernameError('');
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <View style={styles.content}>
          <View style={styles.imageContainer}>
            <Image
              source={require('@/assets/images/halo-angel.png')}
              style={styles.angelImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>Choose your username</Text>
            <Text style={styles.subtitle}>
              3-20 characters, letters, numbers, and underscores only
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.prefix}>@</Text>
            <TextInput
              style={[styles.input, usernameError && styles.inputError]}
              placeholder="username"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              maxLength={20}
            />
          </View>

          {usernameError ? (
            <Text style={styles.errorText}>{usernameError}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.button, (!username.trim() || isLoading) && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!username.trim() || isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#5170FF" />
            ) : (
              <>
                <Text style={styles.buttonText}>Continue</Text>
                <IconSymbol name="arrow.right" size={20} color="#5170FF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5170FF',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  angelImage: {
    width: 120,
    height: 120,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  prefix: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginRight: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginBottom: 16,
    marginLeft: 4,
  },
  button: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 'auto',
    marginBottom: 40,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#5170FF',
  },
});

