import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();

  async function handleSignup() {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      // Use supabase.auth.signUp directly to get user and session from response
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (signUpError) {
        throw signUpError;
      }
      
      // Get user from signUp response or session
      let user = signUpData?.user || null;
      let session = signUpData?.session || null;
      
      console.log('[Signup] SignUp response:', {
        hasUser: !!user,
        userId: user?.id,
        hasSession: !!session,
        sessionUserId: session?.user?.id,
      });
      
      // If no user from signUp response, try to get from session
      if (!user && session) {
        user = session.user;
      }
      
      // If still no user, try getSession() and getUser()
      if (!user) {
        console.log('[Signup] No user from signUp response, trying getSession()...');
        const { data: { session: fetchedSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('[Signup] Error getting session:', sessionError);
        }
        session = fetchedSession || null;
        user = session?.user || null;
        
        if (!user) {
          console.log('[Signup] No user from session, trying getUser()...');
          const { data: { user: fetchedUser }, error: userError } = await supabase.auth.getUser();
          if (userError) {
            console.error('[Signup] Error getting user:', userError);
          }
          user = fetchedUser || null;
        }
      }
      
      console.log('[Signup] Final user check:', {
        hasUser: !!user,
        userId: user?.id,
        hasSession: !!session,
        sessionUserId: session?.user?.id,
      });
      
      if (!user) {
        console.error('[Signup] Could not get user after signup');
        Alert.alert('Error', 'Could not create user session. Please try again.');
        return;
      }
      
      // Wait a bit to ensure session is properly persisted
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      if (user && fullName) {
        // Check if profile exists, if not create it
        const { data: existingProfile, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('[Signup] Error checking profile:', checkError);
        }

        // Check session (may not exist if email confirmation is required)
        const { data: { session: verifySession } } = await supabase.auth.getSession();
        console.log('[Signup] Checking session before profile update:', {
          hasSession: !!verifySession,
          sessionUserId: verifySession?.user?.id,
          userId: user.id,
          match: verifySession?.user?.id === user.id,
        });

        // If no session, we still have the user from signUp response
        // Try to update/create profile anyway - if RLS blocks it, we'll handle the error
        if (!verifySession || verifySession.user.id !== user.id) {
          console.warn('[Signup] No active session (email confirmation may be required), but attempting profile update with user from signUp response');
          // Continue anyway - if RLS blocks it, we'll see the error in the update/insert attempt
        }

        // Try UPDATE first (profile likely exists via trigger)
        // If UPDATE fails with "no rows", then try INSERT
        console.log('[Signup] Attempting to update profile with full_name');
        console.log('[Signup] User ID:', user.id);
        console.log('[Signup] Full Name:', fullName.trim());
        
        const { data: updateData, error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: fullName.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
          .select();
        
        console.log('[Signup] Update result:', {
          dataLength: updateData?.length || 0,
          data: updateData,
          error: updateError ? {
            message: updateError.message,
            code: updateError.code,
            details: updateError.details,
            hint: updateError.hint,
          } : null,
        });
        
        let profileError = updateError;
        let profileSaved = false;
        
        // Check if UPDATE succeeded
        if (!updateError && updateData && updateData.length > 0) {
          console.log('[Signup] ✅ Update succeeded:', updateData[0]);
          profileSaved = true;
        } else if (!updateError && (!updateData || updateData.length === 0)) {
          // UPDATE returned no rows (no error, but nothing was updated)
          // This can happen if RLS policy blocks the update or profile doesn't exist
          console.warn('[Signup] ⚠️ Update returned 0 rows (no error but nothing updated)');
          profileSaved = false;
          profileError = { 
            message: 'Update returned 0 rows', 
            code: 'NO_ROWS_UPDATED',
            details: 'No profile was updated - profile may not exist or RLS policy blocked the update'
          };
        } else if (updateError) {
          console.error('[Signup] Update error:', {
            message: updateError.message,
            code: updateError.code,
            details: updateError.details,
            hint: updateError.hint,
          });
          
          // If UPDATE fails, try INSERT (only if error suggests row doesn't exist)
          if (updateError.code === 'PGRST116' || updateError.message?.includes('0 rows')) {
            console.log('[Signup] Update returned no rows, trying INSERT');
            
            const { data: insertData, error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: user.id,
                full_name: fullName.trim(),
                updated_at: new Date().toISOString(),
              })
              .select();
            
            console.log('[Signup] Insert result:', {
              data: insertData,
              error: insertError ? {
                message: insertError.message,
                code: insertError.code,
                details: insertError.details,
                hint: insertError.hint,
              } : null,
            });
            
            profileError = insertError;
            if (!insertError && insertData && insertData.length > 0) {
              console.log('[Signup] Insert succeeded:', insertData[0]);
              profileSaved = true;
            }
          }
        }

        if (profileError && !profileSaved) {
          console.error('[Signup] Error saving full_name - FINAL ERROR:', profileError);
          
          // If error is RLS-related (permission denied), user needs to confirm email first
          const isRLSError = profileError.code === '42501' || 
                            profileError.message?.includes('permission') ||
                            profileError.message?.includes('policy') ||
                            profileError.message?.includes('RLS') ||
                            profileError.code === 'NO_ROWS_UPDATED';
          
          if (isRLSError) {
            console.warn('[Signup] Profile update blocked by RLS - likely email confirmation required');
            // Don't show alert - just continue to onboarding, user can set profile after email confirmation
          } else {
            Alert.alert(
              'Warning',
              `Profile could not be saved: ${profileError.message || 'Unknown error'}. Please update your profile in Settings.`
            );
          }
        } else if (profileSaved) {
          console.log('[Signup] ✅ Full name saved successfully!');
        } else {
          console.warn('[Signup] ⚠️ Profile update/insert returned no error but no data either');
          // Likely blocked by RLS due to no session - will be set after email confirmation
        }

        // Store name for onboarding (even if profile save failed)
        await AsyncStorage.setItem('@halo_onboarding_name', fullName.trim());
      }

      // Store email and password temporarily for auto-login after email confirmation
      await AsyncStorage.setItem('@halo_pending_email', email);
      await AsyncStorage.setItem('@halo_pending_password', password);

      // Always go to email confirmation screen after signup
      // The screen will automatically redirect to onboarding once email is confirmed
      router.replace({
        pathname: '/(auth)/email-confirmation',
        params: { email: email },
      });
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Join Halo</Text>
              <Text style={styles.subtitle}>Create your safety account</Text>
            </View>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Your Name"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!isLoading}
              />

              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!isLoading}
              />

              <TextInput
                style={styles.input}
                placeholder="Password (min. 6 characters)"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password-new"
                editable={!isLoading}
              />

              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password-new"
                editable={!isLoading}
              />

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSignup}
                disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Create Account</Text>
                )}
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity disabled={isLoading}>
                    <Text style={styles.link}>Sign In</Text>
                  </TouchableOpacity>
                </Link>
              </View>

              <Text style={styles.disclaimer}>
                By signing up, you agree to our Terms of Service and Privacy
                Policy
              </Text>
            </View>
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 48,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  form: {
    gap: 16,
  },
  input: {
    height: 56,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    color: '#fff',
  },
  button: {
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#5170FF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  link: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  disclaimer: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 8,
  },
});

