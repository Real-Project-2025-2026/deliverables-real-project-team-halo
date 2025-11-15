import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { hapticFeedback } from '@/services/haptic-service';
import type { Checkin } from '@/services/checkin-service';

interface CheckinModalProps {
  visible: boolean;
  checkin: Checkin | null;
  onRespond: (response: 'ok' | 'help') => Promise<void>;
  onClose?: () => void;
}

const { width } = Dimensions.get('window');
const CHECKIN_RESPONSE_TIMEOUT = 2 * 60 * 1000; // 2 minutes

export function CheckinModal({ visible, checkin, onRespond, onClose }: CheckinModalProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(CHECKIN_RESPONSE_TIMEOUT);
  const [isResponding, setIsResponding] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible && checkin) {
      // Reset timer
      const dueTime = new Date(checkin.due_at).getTime();
      const now = Date.now();
      const remaining = Math.max(0, dueTime - now);
      setTimeRemaining(remaining);

      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Update timer every second
      const timerInterval = setInterval(() => {
        const now = Date.now();
        const dueTime = new Date(checkin.due_at).getTime();
        const remaining = Math.max(0, dueTime - now);
        setTimeRemaining(remaining);

        if (remaining <= 0) {
          clearInterval(timerInterval);
          if (onClose) {
            onClose();
          }
        }
      }, 1000);

      return () => {
        clearInterval(timerInterval);
      };
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, checkin]);

  async function handleRespond(response: 'ok' | 'help') {
    if (isResponding) return;

    try {
      setIsResponding(true);
      await hapticFeedback(response === 'ok' ? 'success' : 'error');
      await onRespond(response);
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error responding to check-in:', error);
    } finally {
      setIsResponding(false);
    }
  }

  function formatTimeRemaining(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  if (!checkin) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      <BlurView intensity={20} style={styles.container}>
        <Animated.View
          style={[
            styles.modal,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <IconSymbol name="bell.fill" size={48} color="#5170FF" />
            </View>
            <Text style={styles.title}>Are you okay?</Text>
            <Text style={styles.subtitle}>
              Please confirm you're safe
            </Text>
            {timeRemaining > 0 && (
              <View style={styles.timerContainer}>
                <IconSymbol name="clock.fill" size={16} color="#FF9500" />
                <Text style={styles.timerText}>
                  {formatTimeRemaining(timeRemaining)}
                </Text>
              </View>
            )}
          </View>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.okButton, isResponding && styles.buttonDisabled]}
              onPress={() => handleRespond('ok')}
              disabled={isResponding}>
              <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />
              <Text style={styles.buttonText}>Yes, I'm okay</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.helpButton, isResponding && styles.buttonDisabled]}
              onPress={() => handleRespond('help')}
              disabled={isResponding}>
              <IconSymbol name="exclamationmark.triangle.fill" size={24} color="#fff" />
              <Text style={styles.buttonText}>Need Help</Text>
            </TouchableOpacity>
          </View>

          {isResponding && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Sending response...</Text>
            </View>
          )}
        </Animated.View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    width: width * 0.85,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9500',
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  okButton: {
    backgroundColor: '#34C759',
  },
  helpButton: {
    backgroundColor: '#FF3B30',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    marginTop: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
});

