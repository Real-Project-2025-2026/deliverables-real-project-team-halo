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

export default function OnboardingNameScreen() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleContinue() {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User not found. Please log in again.');
      router.replace('/(auth)/login');
      return;
    }

    setIsLoading(true);
    try {
      // Verify session is active
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('[OnboardingName] Session check:', {
        hasSession: !!session,
        userId: session?.user?.id,
        matchesUser: session?.user?.id === user.id,
        sessionError,
      });

      if (!session || session.user.id !== user.id) {
        Alert.alert('Error', 'Session not active. Please log in again.');
        router.replace('/(auth)/login');
        return;
      }

      // Wait for user to be fully created in auth.users and profile to be created by trigger
      console.log('[OnboardingName] Waiting for user and profile to be ready...');
      
      let profileReady = false;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (!profileReady && attempts < maxAttempts) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        // Check if profile exists (created by trigger)
        const { data: existingProfile, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        if (existingProfile) {
          profileReady = true;
          console.log(`[OnboardingName] ✅ Profile exists after attempt ${attempts}`);
        } else if (checkError?.code !== 'PGRST116') {
          console.log(`[OnboardingName] Attempt ${attempts}: Profile not found, waiting...`);
        }
      }
      
      if (!profileReady) {
        // Profile doesn't exist after waiting - trigger might not have fired
        // Create profile manually as fallback
        console.log('[OnboardingName] Profile not found, creating manually...');
        
        const { data: manualProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            full_name: fullName.trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (createError) {
          console.error('[OnboardingName] ⚠️ Manual profile creation failed:', createError);
          
          if (createError.code === '23503') {
            Alert.alert('Error', 'User not fully created yet. Please wait a moment and try again.');
          } else {
            Alert.alert('Error', `Failed to create profile: ${createError.message || 'Unknown error'}`);
          }
          return;
        }
        
        console.log('[OnboardingName] ✅ Profile created manually:', manualProfile);
        // Profile created, continue to username screen
        await new Promise((resolve) => setTimeout(resolve, 300));
        router.replace('/(auth)/onboarding-username');
        return;
      }

      // Now that profile exists, just UPDATE it
      console.log('[OnboardingName] Updating profile with full_name...');
      
      let updateSuccess = false;
      let updateAttempts = 0;
      const maxUpdateAttempts = 3;
      
      while (!updateSuccess && updateAttempts < maxUpdateAttempts) {
        updateAttempts++;
        
        console.log(`[OnboardingName] Attempt ${updateAttempts}: Updating profile...`);
        const { data: updateData, error: updateError, count } = await supabase
          .from('profiles')
          .update({
            full_name: fullName.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
          .select()
          .single();

        console.log(`[OnboardingName] Update result:`, {
          hasData: !!updateData,
          data: updateData,
          error: updateError ? {
            message: updateError.message,
            code: updateError.code,
            details: updateError.details,
          } : null,
        });

        if (updateError) {
          console.error(`[OnboardingName] Update attempt ${updateAttempts} failed:`, updateError);
          
          // If RLS blocks update, wait and retry
          if (updateError.code === '42501' || updateError.message?.includes('policy') || updateError.message?.includes('permission')) {
            console.log(`[OnboardingName] RLS blocked update, waiting and retrying...`);
          }
          
          if (updateAttempts < maxUpdateAttempts) {
            // Wait and retry
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          } else {
            // All attempts failed
            Alert.alert('Error', `Failed to save name: ${updateError.message || 'Unknown error'}`);
            return;
          }
        }
        
        if (updateData) {
          console.log('[OnboardingName] ✅ Full name saved successfully:', updateData);
          updateSuccess = true;
        } else {
          console.log(`[OnboardingName] Update attempt ${updateAttempts} returned no data`);
          
          // Check if update actually worked by querying the profile
          const { data: checkData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();
          
          if (checkData?.full_name === fullName.trim()) {
            console.log('[OnboardingName] ✅ Full name was saved (verified via query)');
            updateSuccess = true;
          } else {
            console.log(`[OnboardingName] Update didn't work, full_name is:`, checkData?.full_name);
            if (updateAttempts < maxUpdateAttempts) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            } else {
              Alert.alert('Error', 'Failed to save name. Please try again.');
              return;
            }
          }
        }
      }

      // Verify it was saved
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Navigate to username screen
      router.replace('/(auth)/onboarding-username');
    } catch (error: any) {
      console.error('[OnboardingName] Error:', error);
      Alert.alert('Error', error.message || 'Failed to save name');
    } finally {
      setIsLoading(false);
    }
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
            <Text style={styles.title}>What's your name?</Text>
            <Text style={styles.subtitle}>
              Enter your full name so others can find you
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Your full name"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[styles.button, (!fullName.trim() || isLoading) && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!fullName.trim() || isLoading}>
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
    marginBottom: 32,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
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

