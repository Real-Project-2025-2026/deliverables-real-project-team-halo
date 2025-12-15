import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let alarmSound: Audio.Sound | null = null;
let isPlaying = false;

/**
 * Configure audio mode for alarm playback
 */
async function configureAudioMode(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true, // Wichtig: Spielt auch bei stummgeschaltetem iPhone
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
  } catch (error) {
    console.error('[Alarm Service] Error configuring audio mode:', error);
  }
}

/**
 * Generate a simple alarm tone using oscillating frequencies
 * This creates an emergency siren effect
 */
async function createAlarmSound(): Promise<Audio.Sound | null> {
  try {
    // Verwende einen öffentlichen Alarm-Sound
    // Fallback: Erstelle einen einfachen Beep-Ton
    const { sound } = await Audio.Sound.createAsync(
      // Sirenen-Sound URL (freier Sound)
      { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
      { 
        shouldPlay: false,
        isLooping: true,
        volume: 1.0,
      }
    );
    return sound;
  } catch (error) {
    console.error('[Alarm Service] Error creating alarm sound:', error);
    
    // Fallback: Versuche einen anderen Sound
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3' },
        { 
          shouldPlay: false,
          isLooping: true,
          volume: 1.0,
        }
      );
      return sound;
    } catch (fallbackError) {
      console.error('[Alarm Service] Fallback sound also failed:', fallbackError);
      return null;
    }
  }
}

/**
 * Start the alarm siren
 */
export async function startAlarm(): Promise<void> {
  if (isPlaying) {
    console.log('[Alarm Service] Alarm already playing');
    return;
  }

  try {
    console.log('[Alarm Service] Starting alarm...');
    
    // Configure audio mode first
    await configureAudioMode();
    
    // Stop any existing sound
    if (alarmSound) {
      await alarmSound.unloadAsync();
      alarmSound = null;
    }
    
    // Create and play the alarm sound
    alarmSound = await createAlarmSound();
    
    if (alarmSound) {
      await alarmSound.setVolumeAsync(1.0);
      await alarmSound.playAsync();
      isPlaying = true;
      console.log('[Alarm Service] Alarm started successfully');
    } else {
      console.error('[Alarm Service] Could not create alarm sound');
    }
  } catch (error) {
    console.error('[Alarm Service] Error starting alarm:', error);
    isPlaying = false;
  }
}

/**
 * Stop the alarm siren
 */
export async function stopAlarm(): Promise<void> {
  if (!isPlaying && !alarmSound) {
    console.log('[Alarm Service] No alarm to stop');
    return;
  }

  try {
    console.log('[Alarm Service] Stopping alarm...');
    
    if (alarmSound) {
      await alarmSound.stopAsync();
      await alarmSound.unloadAsync();
      alarmSound = null;
    }
    
    isPlaying = false;
    console.log('[Alarm Service] Alarm stopped successfully');
  } catch (error) {
    console.error('[Alarm Service] Error stopping alarm:', error);
    isPlaying = false;
    alarmSound = null;
  }
}

/**
 * Check if alarm is currently playing
 */
export function isAlarmPlaying(): boolean {
  return isPlaying;
}

/**
 * Play alarm for a specific duration then stop
 */
export async function playAlarmForDuration(durationMs: number): Promise<void> {
  await startAlarm();
  
  setTimeout(async () => {
    await stopAlarm();
  }, durationMs);
}

