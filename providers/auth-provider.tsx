import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/supabase';
import { registerPushToken } from '@/services/notification-service';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Tables<'profiles'> | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Track if we've already registered push token for this session
  const pushTokenRegisteredRef = useRef<boolean>(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // Reset push token registration flag on auth change
      pushTokenRegisteredRef.current = false;
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Profile doesn't exist - try to create it if we have full_name in AsyncStorage
        if (error.code === 'PGRST116') {
          console.log('[AuthProvider] Profile not found, checking AsyncStorage for full_name...');
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const fullName = await AsyncStorage.getItem('@halo_onboarding_name');
          
          if (fullName && fullName.trim()) {
            console.log('[AuthProvider] Found full_name in AsyncStorage, creating profile...');
            // Try to create profile with full_name
            const { data: newProfile, error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: userId,
                full_name: fullName.trim(),
                updated_at: new Date().toISOString(),
              })
              .select()
              .single();
            
            if (insertError) {
              console.error('[AuthProvider] Error creating profile:', insertError);
              // Don't throw - user can set profile later
            } else {
              console.log('[AuthProvider] ✅ Profile created with full_name:', newProfile);
              setProfile(newProfile);
              // Clear AsyncStorage after successful creation
              await AsyncStorage.removeItem('@halo_onboarding_name');
            }
          } else {
            // No full_name in AsyncStorage - profile will be created later
            console.log('[AuthProvider] No full_name in AsyncStorage, profile will be created later');
          }
        } else {
          throw error;
        }
      } else {
        setProfile(data);
        
        // If profile exists but has no full_name, check AsyncStorage
        if (data && !data.full_name) {
          console.log('[AuthProvider] Profile exists but no full_name, checking AsyncStorage...');
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const fullName = await AsyncStorage.getItem('@halo_onboarding_name');
          
          if (fullName && fullName.trim()) {
            console.log('[AuthProvider] Found full_name in AsyncStorage, updating profile...');
            const { data: updatedProfile, error: updateError } = await supabase
              .from('profiles')
              .update({
                full_name: fullName.trim(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', userId)
              .select()
              .single();
            
            if (updateError) {
              console.error('[AuthProvider] Error updating profile with full_name:', updateError);
            } else {
              console.log('[AuthProvider] ✅ Profile updated with full_name:', updatedProfile);
              setProfile(updatedProfile);
              // Clear AsyncStorage after successful update
              await AsyncStorage.removeItem('@halo_onboarding_name');
            }
          }
        }
      }

      // Register push token only once per session (avoid rate limiting)
      if (!pushTokenRegisteredRef.current) {
        pushTokenRegisteredRef.current = true;
        registerPushToken().catch((err) => {
          console.error('Error registering push token:', err);
          // Reset flag on error so we can retry later
          pushTokenRegisteredRef.current = false;
          // Don't block profile loading if push registration fails
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function signUp(email: string, password: string) {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  }

  const value = {
    session,
    user,
    profile,
    isLoading,
    signIn,
    signUp,
    signOut,
    refreshProfile: async () => {
      if (user) {
        await loadProfile(user.id);
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

