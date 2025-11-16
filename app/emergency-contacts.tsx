import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEmergencyContact } from '@/hooks/use-emergency-contact';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { EmergencyContact } from '@/services/emergency-contact-service';

export default function EmergencyContactsScreen() {
  const { contacts, isLoading, createContact, updateContact, deleteContact } =
    useEmergencyContact();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const [priority, setPriority] = useState('1');
  const [notifyOnTripStart, setNotifyOnTripStart] = useState(false);
  const [notifyOnTripEnd, setNotifyOnTripEnd] = useState(false);
  const [notifyOnEscalation, setNotifyOnEscalation] = useState(true);
  const [notifyOnSafetogether, setNotifyOnSafetogether] = useState(true);

  const resetForm = () => {
    setName('');
    setPhoneNumber('');
    setEmail('');
    setRelationship('');
    setPriority('1');
    setNotifyOnTripStart(false);
    setNotifyOnTripEnd(false);
    setNotifyOnEscalation(true);
    setNotifyOnSafetogether(true);
    setEditingContact(null);
  };

  const handleAddPress = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEditPress = (contact: EmergencyContact) => {
    setName(contact.name);
    setPhoneNumber(contact.phone_number);
    setEmail(contact.email || '');
    setRelationship(contact.relationship || '');
    setPriority(contact.priority?.toString() || '1');
    setNotifyOnTripStart(contact.notify_on_trip_start ?? false);
    setNotifyOnTripEnd(contact.notify_on_trip_end ?? false);
    setNotifyOnEscalation(contact.notify_on_escalation ?? true);
    setNotifyOnSafetogether(contact.notify_on_safetogether ?? true);
    setEditingContact(contact);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !phoneNumber.trim()) {
      Alert.alert('Error', 'Name and phone number are required');
      return;
    }

    const params = {
      name: name.trim(),
      phoneNumber: phoneNumber.trim(),
      email: email.trim() || undefined,
      relationship: relationship.trim() || undefined,
      priority: parseInt(priority) || 1,
      notifyOnTripStart,
      notifyOnTripEnd,
      notifyOnEscalation,
      notifyOnSafetogether,
    };

    let success = false;
    if (editingContact) {
      success = await updateContact(editingContact.id, params);
    } else {
      success = await createContact(params);
    }

    if (success) {
      setShowAddModal(false);
      resetForm();
    } else {
      Alert.alert('Error', 'Failed to save emergency contact');
    }
  };

  const handleDelete = (contact: EmergencyContact) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete ${contact.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteContact(contact.id);
            if (!success) {
              Alert.alert('Error', 'Failed to delete emergency contact');
            }
          },
        },
      ]
    );
  };

  const renderContact = useCallback(
    ({ item }: { item: EmergencyContact }) => (
      <TouchableOpacity
        style={styles.contactCard}
        onPress={() => handleEditPress(item)}>
        <View style={styles.contactHeader}>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{item.name}</Text>
            {item.relationship && (
              <Text style={styles.contactRelationship}>{item.relationship}</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}>
            <IconSymbol name="trash" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
        <View style={styles.contactDetails}>
          <View style={styles.contactRow}>
            <IconSymbol name="phone.fill" size={16} color="#fff" />
            <Text style={styles.contactText}>{item.phone_number}</Text>
          </View>
          {item.email && (
            <View style={styles.contactRow}>
              <IconSymbol name="envelope.fill" size={16} color="#fff" />
              <Text style={styles.contactText}>{item.email}</Text>
            </View>
          )}
        </View>
        <View style={styles.notificationBadges}>
          {item.notify_on_trip_start && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Trip Start</Text>
            </View>
          )}
          {item.notify_on_trip_end && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Trip End</Text>
            </View>
          )}
          {item.notify_on_escalation && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Emergency</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    ),
    []
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <IconSymbol name="person.2.fill" size={64} color="rgba(255, 255, 255, 0.3)" />
      <Text style={styles.emptyTitle}>No Emergency Contacts</Text>
      <Text style={styles.emptyText}>
        Add trusted contacts who will be notified in case of an emergency.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Emergency Contacts</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddPress}>
          <IconSymbol name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Contact List */}
      {isLoading && contacts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : (
        <FlatList
          data={contacts}
          renderItem={renderContact}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={
            contacts.length === 0 ? styles.emptyContainer : styles.listContainer
          }
          ListEmptyComponent={renderEmpty}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}>
          <SafeAreaView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingContact ? 'Edit Contact' : 'Add Contact'}
              </Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+49123456789"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="john@example.com"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Relationship (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mother, Friend, etc."
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={relationship}
                  onChangeText={setRelationship}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Priority</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={priority}
                  onChangeText={setPriority}
                  keyboardType="number-pad"
                />
                <Text style={styles.hint}>
                  Lower numbers are notified first (1 = highest priority)
                </Text>
              </View>

              <View style={styles.sectionDivider} />

              <Text style={styles.sectionTitle}>Notification Settings</Text>

              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>Notify on Trip Start</Text>
                  <Text style={styles.switchHint}>
                    Send notification when you start a trip
                  </Text>
                </View>
                <Switch
                  value={notifyOnTripStart}
                  onValueChange={setNotifyOnTripStart}
                  trackColor={{ false: '#767577', true: '#34C759' }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>Notify on Trip End</Text>
                  <Text style={styles.switchHint}>
                    Send notification when you complete a trip
                  </Text>
                </View>
                <Switch
                  value={notifyOnTripEnd}
                  onValueChange={setNotifyOnTripEnd}
                  trackColor={{ false: '#767577', true: '#34C759' }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>Notify on Emergency</Text>
                  <Text style={styles.switchHint}>
                    Send notification if you miss check-ins or need help
                  </Text>
                </View>
                <Switch
                  value={notifyOnEscalation}
                  onValueChange={setNotifyOnEscalation}
                  trackColor={{ false: '#767577', true: '#FF3B30' }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>Notify on SafeTogether</Text>
                  <Text style={styles.switchHint}>
                    Send notification when you pair with nearby users
                  </Text>
                </View>
                <Switch
                  value={notifyOnSafetogether}
                  onValueChange={setNotifyOnSafetogether}
                  trackColor={{ false: '#767577', true: '#34C759' }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5170FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 24,
    gap: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  contactRelationship: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.7,
  },
  deleteButton: {
    padding: 8,
  },
  contactDetails: {
    gap: 8,
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  notificationBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#5170FF',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalCancel: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  form: {
    flex: 1,
    padding: 24,
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
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
  hint: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.6,
    marginTop: 4,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 4,
  },
  switchHint: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.7,
  },
});

