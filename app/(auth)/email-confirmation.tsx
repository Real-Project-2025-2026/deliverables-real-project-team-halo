import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  AppState,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/providers/auth-provider';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function EmailConfirmationScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { session, isLoading: authLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [checkCount, setCheckCount] = useState(0);
  const MAX_CHECKS = 60; // Check for 60 seconds (every 2 seconds = 30 checks)

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let checkAttempts = 0;

    const checkEmailConfirmation = async () => {
      try {
        // Get stored email and password for auto-login
        const storedEmail = await AsyncStorage.getItem('@halo_pending_email');
        const storedPassword = await AsyncStorage.getItem('@halo_pending_password');
        
        // Always try to login with stored credentials if available (try every check after first 2)
        if (storedEmail && storedPassword && checkAttempts >= 2) {
          console.log('[EmailConfirmation] Attempting auto-login with stored credentials (attempt ' + (checkAttempts + 1) + ')...');
          try {
            const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
              email: storedEmail,
              password: storedPassword,
            });
            
            // Check session AFTER login attempt (even if error)
            const { data: { session: loginSession } } = await supabase.auth.getSession();
            
            if (loginError) {
              console.log('[EmailConfirmation] Auto-login error:', loginError.message);
              
              // Check if we still got a session despite the error (sometimes happens)
              if (loginSession && loginSession.user && loginSession.user.email_confirmed_at) {
                console.log('[EmailConfirmation] ✅ Got session despite error! Email confirmed, redirecting...');
                setIsChecking(false);
                
                // Clear stored credentials
                await AsyncStorage.removeItem('@halo_pending_email');
                await AsyncStorage.removeItem('@halo_pending_password');
                
                // Clear interval
                if (intervalId) {
                  clearInterval(intervalId);
                }

                setTimeout(() => {
                  router.replace('/(tabs)');
                }, 500);
                return;
              }
              
              // If email not confirmed error, continue checking
              if (loginError.message.includes('Email not confirmed') || loginError.message.includes('email_not_confirmed') || loginError.message.includes('not confirmed')) {
                console.log('[EmailConfirmation] Email not yet confirmed, continuing to check...');
              } else {
                // For other errors, don't clear credentials yet - might still work
                console.log('[EmailConfirmation] Auto-login failed, but will retry:', loginError.message);
              }
            } else if (loginData && loginData.session && loginData.user) {
              console.log('[EmailConfirmation] ✅ Auto-login successful! Session active, redirecting...');
              setIsChecking(false);
              
              // Clear stored credentials
              await AsyncStorage.removeItem('@halo_pending_email');
              await AsyncStorage.removeItem('@halo_pending_password');
              
              // Clear interval
              if (intervalId) {
                clearInterval(intervalId);
              }

              // Small delay before redirecting to main app
              setTimeout(() => {
                console.log('[EmailConfirmation] Navigating to /(tabs)');
                router.replace('/(tabs)');
              }, 500);

              return;
            }
          } catch (autoLoginError: any) {
            console.error('[EmailConfirmation] Auto-login exception:', autoLoginError?.message || autoLoginError);
            // Still check session even if exception
            const { data: { session: exceptionSession } } = await supabase.auth.getSession();
            if (exceptionSession && exceptionSession.user && exceptionSession.user.email_confirmed_at) {
              console.log('[EmailConfirmation] ✅ Got session after exception! Email confirmed');
              setIsChecking(false);
              await AsyncStorage.removeItem('@halo_pending_email');
              await AsyncStorage.removeItem('@halo_pending_password');
              if (intervalId) clearInterval(intervalId);
              setTimeout(() => router.replace('/(tabs)'), 500);
              return;
            }
          }
        }
        
        // Check if session is active (email confirmed)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        console.log('[EmailConfirmation] Checking session:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          userEmail: session?.user?.email,
          emailConfirmed: session?.user?.email_confirmed_at ? 'yes' : 'no',
          checkAttempt: checkAttempts + 1,
          hasStoredCredentials: !!(storedEmail && storedPassword),
        });

        // Check if we have a session with a confirmed user
        if (session && session.user && session.user.email_confirmed_at) {
          console.log('[EmailConfirmation] ✅ Email confirmed! Session active, redirecting...');
          setIsChecking(false);
          
          // Clear stored credentials
          await AsyncStorage.removeItem('@halo_pending_email');
          await AsyncStorage.removeItem('@halo_pending_password');
          
          // Clear interval
          if (intervalId) {
            clearInterval(intervalId);
          }

          // Small delay before redirecting to main app
          setTimeout(() => {
            console.log('[EmailConfirmation] Navigating to /(tabs)');
            router.replace('/(tabs)');
          }, 500);

          return;
        }

        if (sessionError) {
          console.error('[EmailConfirmation] Error checking session:', sessionError);
          return;
        }

        // Increment check count
        checkAttempts++;
        setCheckCount(checkAttempts);

        // Stop checking after max attempts
        if (checkAttempts >= MAX_CHECKS) {
          console.log('[EmailConfirmation] Max checks reached, stopping');
          setIsChecking(false);
          if (intervalId) {
            clearInterval(intervalId);
          }
        }
      } catch (error) {
        console.error('[EmailConfirmation] Error in checkEmailConfirmation:', error);
      }
    };

    // Check immediately
    checkEmailConfirmation();

    // Then check every 2 seconds
    intervalId = setInterval(checkEmailConfirmation, 2000);

    // Listen for auth state changes (more reliable)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[EmailConfirmation] Auth state changed:', {
        event,
        hasSession: !!session,
        hasUser: !!session?.user,
        userEmail: session?.user?.email,
        emailConfirmed: session?.user?.email_confirmed_at ? 'yes' : 'no',
      });
      
      if (event === 'SIGNED_IN' && session && session.user && session.user.email_confirmed_at) {
        console.log('[EmailConfirmation] ✅ Email confirmed via auth state change! Redirecting...');
        setIsChecking(false);
        
        if (intervalId) {
          clearInterval(intervalId);
        }

        setTimeout(() => {
          console.log('[EmailConfirmation] Navigating to /(tabs) from auth state change');
          router.replace('/(tabs)');
        }, 500);
      }
    });

    // Listen for app state changes (when user comes back from email app)
    const appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[EmailConfirmation] App became active, checking session...');
        // Check session when app comes to foreground
        try {
          // Try to refresh session if we have one
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession) {
            await supabase.auth.refreshSession();
          }
          // Always check for confirmation
          checkEmailConfirmation();
        } catch (error) {
          console.error('[EmailConfirmation] Error on app state change:', error);
          // Still try to check
          checkEmailConfirmation();
        }
      }
    });

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      subscription.unsubscribe();
      appStateSubscription?.remove();
    };
  }, []);

  // Also watch for session changes from AuthProvider
  useEffect(() => {
    if (!authLoading && session && session.user && session.user.email_confirmed_at) {
      console.log('[EmailConfirmation] ✅ Session confirmed via AuthProvider! Redirecting...');
      setIsChecking(false);
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 500);
    } else if (!authLoading && !session) {
      // No session - check if email was confirmed via getUser
      const checkUserConfirmed = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email_confirmed_at && !isChecking) {
            console.log('[EmailConfirmation] ✅ Email confirmed via getUser, but no session');
            setIsChecking(false);
          }
        } catch (error) {
          // Ignore errors - user might not exist yet
        }
      };
      checkUserConfirmed();
    }
  }, [session, authLoading, isChecking]);

  const email = params.email || 'your email';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.imageContainer}>
          <Image
            source={require('@/assets/images/halo-angel.png')}
            style={styles.angelImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>Check your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a confirmation email to
          </Text>
          <Text style={styles.email}>{email}</Text>
          <Text style={styles.description}>
            Please click the confirmation link in the email to verify your account.
            This page will automatically update once you've confirmed.
          </Text>
        </View>

        {isChecking ? (
          <View style={styles.checkingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.checkingText}>
              Waiting for email confirmation...
            </Text>
            <Text style={styles.checkingSubtext}>
              This may take a few moments
            </Text>
            {checkCount > 3 && (
              <TouchableOpacity
                style={styles.manualButton}
                onPress={async () => {
                  console.log('[EmailConfirmation] Manual check triggered');
                  try {
                    // Get stored credentials
                    const storedEmail = await AsyncStorage.getItem('@halo_pending_email');
                    const storedPassword = await AsyncStorage.getItem('@halo_pending_password');
                    
                    // Try to login first
                    if (storedEmail && storedPassword) {
                      console.log('[EmailConfirmation] Manual check: Attempting login...');
                      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                        email: storedEmail,
                        password: storedPassword,
                      });
                      
                      // Check session after login attempt
                      const { data: { session } } = await supabase.auth.getSession();
                      
                      if (loginData?.session || (session && session.user && session.user.email_confirmed_at)) {
                        console.log('[EmailConfirmation] ✅ Manual check: Login successful!');
                        await AsyncStorage.removeItem('@halo_pending_email');
                        await AsyncStorage.removeItem('@halo_pending_password');
                        router.replace('/(tabs)');
                        return;
                      } else if (loginError) {
                        console.log('[EmailConfirmation] Manual check: Login error:', loginError.message);
                        if (loginError.message.includes('not confirmed')) {
                          Alert.alert(
                            'Email Not Confirmed',
                            'Please check your email and click the confirmation link. The app will automatically detect when you confirm your email.'
                          );
                          return;
                        }
                      }
                    }
                    
                    // Fallback: Check if email is confirmed
                    const { data: { user } } = await supabase.auth.getUser();
                    const { data: { session } } = await supabase.auth.getSession();
                    
                    if (user?.email_confirmed_at || session?.user?.email_confirmed_at) {
                      console.log('[EmailConfirmation] ✅ Manual check: Email confirmed!');
                      
                      if (session && session.user) {
                        // Has session, go to app
                        router.replace('/(tabs)');
                      } else {
                        // No session, redirect to login
                        router.replace('/(auth)/login');
                      }
                    } else {
                      console.log('[EmailConfirmation] Manual check: Email not yet confirmed');
                      Alert.alert(
                        'Email Not Confirmed',
                        'Please check your email and click the confirmation link. The app will automatically detect when you confirm your email.'
                      );
                    }
                  } catch (error: any) {
                    console.error('[EmailConfirmation] Manual check error:', error);
                    Alert.alert(
                      'Error',
                      'An error occurred. Please try logging in manually.'
                    );
                  }
                }}>
                <Text style={styles.manualButtonText}>I've confirmed my email</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.checkingContainer}>
            <IconSymbol name="checkmark.circle.fill" size={48} color="#34C759" />
            <Text style={styles.confirmedText}>
              Email confirmed!
            </Text>
            <Text style={styles.confirmedSubtext}>
              Please log in to continue
            </Text>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => {
                router.replace('/(auth)/login');
              }}>
              <Text style={styles.loginButtonText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Didn't receive the email? Check your spam folder or try signing up again.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5170FF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
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
    marginBottom: 8,
    textAlign: 'center',
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  checkingContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  checkingText: {
    fontSize: 16,
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
  checkingSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
    textAlign: 'center',
  },
  confirmedText: {
    fontSize: 16,
    color: '#fff',
    marginTop: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
  },
  manualButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  manualButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmedSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginTop: 24,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#5170FF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

