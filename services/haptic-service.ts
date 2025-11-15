import * as Haptics from 'expo-haptics';

/**
 * Vibrate for check-in reminder
 */
export async function vibrateCheckin(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Wait a bit and vibrate again
    setTimeout(async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 200);
  } catch (error) {
    console.error('Error vibrating for check-in:', error);
  }
}

/**
 * Vibrate for emergency escalation
 */
export async function vibrateEmergency(): Promise<void> {
  try {
    // Strong, repeated vibrations
    for (let i = 0; i < 3; i++) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  } catch (error) {
    console.error('Error vibrating for emergency:', error);
  }
}

/**
 * Haptic feedback for button press
 */
export async function hapticFeedback(
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'
): Promise<void> {
  try {
    switch (type) {
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch (error) {
    console.error('Error with haptic feedback:', error);
  }
}


