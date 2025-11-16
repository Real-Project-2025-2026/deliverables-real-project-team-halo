import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/providers/auth-provider';
import { supabase } from '@/lib/supabase';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Request permissions for image picker
  const requestImagePickerPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'We need access to your photos to set a profile picture.'
      );
      return false;
    }
    return true;
  }, []);

  // Pick and upload avatar
  const handlePickAvatar = useCallback(async () => {
    const hasPermission = await requestImagePickerPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const imageUri = result.assets[0].uri;
      setAvatarUri(imageUri);
      setIsUploading(true);

      // Upload to Supabase Storage
      // The RLS policy requires the path to be: avatars/{user_id}/{filename}
      const fileExt = imageUri.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      // Read the file as ArrayBuffer for React Native
      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Determine correct MIME type
      let mimeType = `image/${fileExt}`;
      if (fileExt === 'jpg' || fileExt === 'jpeg') {
        mimeType = 'image/jpeg';
      } else if (fileExt === 'png') {
        mimeType = 'image/png';
      } else if (fileExt === 'gif') {
        mimeType = 'image/gif';
      } else if (fileExt === 'webp') {
        mimeType = 'image/webp';
      }

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, bytes, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user?.id);

      if (updateError) {
        throw updateError;
      }

      setAvatarUri(publicUrl);
      await refreshProfile();
      Alert.alert('Success', 'Profile picture updated!');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Error', error.message || 'Failed to upload profile picture');
      setAvatarUri(profile?.avatar_url || null);
    } finally {
      setIsUploading(false);
    }
  }, [user?.id, profile?.avatar_url, refreshProfile, requestImagePickerPermission]);

  // Save profile
  const handleSave = useCallback(async () => {
    if (!user?.id) return;

    // Validate username if provided
    if (username && (username.length < 3 || username.length > 20)) {
      Alert.alert('Error', 'Username must be between 3 and 20 characters');
      return;
    }

    if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
      Alert.alert('Error', 'Username can only contain letters, numbers, and underscores');
      return;
    }

    setIsLoading(true);
    try {
      const updateData: {
        full_name?: string;
        username?: string;
        updated_at: string;
      } = {
        updated_at: new Date().toISOString(),
      };

      if (fullName.trim()) {
        updateData.full_name = fullName.trim();
      }

      if (username.trim()) {
        updateData.username = username.trim().toLowerCase();
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      await refreshProfile();
      Alert.alert('Success', 'Profile updated!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      if (error.code === '23505') {
        Alert.alert('Error', 'This username is already taken');
      } else {
        Alert.alert('Error', error.message || 'Failed to update profile');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, fullName, username, refreshProfile]);

  // Render avatar
  const renderAvatar = () => {
    const firstLetter = (username || fullName || user?.email || '?')[0].toUpperCase();

    if (avatarUri) {
      return (
        <Image
          source={{ uri: avatarUri }}
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
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>My Profile</Text>
        </View>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handlePickAvatar}
            disabled={isUploading}>
            {renderAvatar()}
            {isUploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
            <View style={styles.editAvatarButton}>
              <IconSymbol name="camera.fill" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Tap to change photo</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Email (read-only) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>{user?.email}</Text>
            </View>
          </View>

          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>

          {/* Username */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter username (optional)"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            <Text style={styles.hint}>
              3-20 characters, letters, numbers, and underscores only
            </Text>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, (isLoading || isUploading) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isLoading || isUploading}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#5170FF" />
            ) : (
              <>
                <IconSymbol name="checkmark.circle.fill" size={20} color="#5170FF" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5170FF',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: '600',
    color: '#fff',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#5170FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  formSection: {
    paddingHorizontal: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    opacity: 0.9,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  readOnlyInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  readOnlyText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5170FF',
  },
});

