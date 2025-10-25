import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const wp = (percentage) => (screenWidth * percentage) / 100;
const hp = (percentage) => (screenHeight * percentage) / 100;
const isSmallDevice = screenWidth < 375;

const BASE_URL = 'https://hdcpmss-mobilefinal.onrender.com';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser] = useState({
    username: '',
    email: '',
    contactNumber: '',
  });
  const [editedUser, setEditedUser] = useState({
    username: '',
    email: '',
    contactNumber: '',
  });
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please login again');
        navigation.replace('LoginScreen');
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/users/update-profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const userData = {
        username: response.data.username,
        email: response.data.email,
        contactNumber: response.data.contactNumber || '',
      };

      setUser(userData);
      setEditedUser(userData);
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editedUser.username.trim()) {
      Alert.alert('Error', 'Username is required');
      return;
    }
    if (!editedUser.contactNumber.trim()) {
      Alert.alert('Error', 'Contact number is required');
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(
        `${BASE_URL}/api/users/update-profile`,
        {
          username: editedUser.username.trim(),
          contactNumber: editedUser.contactNumber.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUser(editedUser);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedUser(user);
    setIsEditing(false);
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      Alert.alert('Error', 'Please fill all password fields');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(
        `${BASE_URL}/api/users/change-password`,
        {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Password changed successfully');
      setChangePasswordModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['token', 'userId', 'userEmail']);
            navigation.replace('LoginScreen');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#048E04" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#048E04" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={wp(6)} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={wp(20)} color="#048E04" />
              </View>
            </View>
            <Text style={styles.profileName}>{user.username}</Text>
            <Text style={styles.profileEmail}>{user.email}</Text>
          </View>

          {/* Profile Information Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Personal Information</Text>
              {!isEditing && (
                <TouchableOpacity
                  onPress={() => setIsEditing(true)}
                  style={styles.editButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={wp(5)} color="#048E04" />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.cardContent}>
              {/* Username */}
              <View style={styles.infoGroup}>
                <Text style={styles.infoLabel}>Username</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.infoInput}
                    value={editedUser.username}
                    onChangeText={(text) =>
                      setEditedUser({ ...editedUser, username: text })
                    }
                    placeholder="Enter username"
                    placeholderTextColor="#999"
                  />
                ) : (
                  <Text style={styles.infoValue}>{user.username}</Text>
                )}
              </View>

              {/* Email (Read-only) */}
              <View style={styles.infoGroup}>
                <Text style={styles.infoLabel}>Email</Text>
                <View style={styles.disabledInputContainer}>
                  <Text style={styles.disabledInputText}>{user.email}</Text>
                  <View style={styles.lockedBadge}>
                    <Ionicons name="lock-closed" size={wp(3.5)} color="#6B7280" />
                  </View>
                </View>
              </View>

              {/* Contact Number */}
              <View style={styles.infoGroup}>
                <Text style={styles.infoLabel}>Contact Number</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.infoInput}
                    value={editedUser.contactNumber}
                    onChangeText={(text) =>
                      setEditedUser({ ...editedUser, contactNumber: text })
                    }
                    placeholder="Enter contact number"
                    placeholderTextColor="#999"
                    keyboardType="phone-pad"
                  />
                ) : (
                  <Text style={styles.infoValue}>
                    {user.contactNumber || 'Not provided'}
                  </Text>
                )}
              </View>

              {/* Edit Actions */}
              {isEditing && (
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancelEdit}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveProfile}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Security Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Security</Text>
            <View style={styles.cardContent}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setChangePasswordModal(true)}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconContainer}>
                  <Ionicons name="key-outline" size={wp(5.5)} color="#048E04" />
                </View>
                <Text style={styles.menuItemText}>Change Password</Text>
                <Ionicons name="chevron-forward" size={wp(5)} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={wp(5.5)} color="#EF4444" />
                <Text style={styles.logoutButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Change Password Modal */}
        <Modal
          visible={changePasswordModal}
          animationType="slide"
          transparent
          onRequestClose={() => setChangePasswordModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Change Password</Text>
                <TouchableOpacity
                  onPress={() => setChangePasswordModal(false)}
                  style={styles.closeButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={wp(6)} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Current Password */}
                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalInputLabel}>Current Password</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={passwordData.currentPassword}
                      onChangeText={(text) =>
                        setPasswordData({ ...passwordData, currentPassword: text })
                      }
                      placeholder="Enter current password"
                      placeholderTextColor="#999"
                      secureTextEntry={!showCurrentPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                      style={styles.eyeButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showCurrentPassword ? 'eye-off' : 'eye'}
                        size={wp(5)}
                        color="#9CA3AF"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* New Password */}
                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalInputLabel}>New Password</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={passwordData.newPassword}
                      onChangeText={(text) =>
                        setPasswordData({ ...passwordData, newPassword: text })
                      }
                      placeholder="Enter new password"
                      placeholderTextColor="#999"
                      secureTextEntry={!showNewPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPassword(!showNewPassword)}
                      style={styles.eyeButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showNewPassword ? 'eye-off' : 'eye'}
                        size={wp(5)}
                        color="#9CA3AF"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalInputLabel}>Confirm New Password</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={passwordData.confirmPassword}
                      onChangeText={(text) =>
                        setPasswordData({ ...passwordData, confirmPassword: text })
                      }
                      placeholder="Confirm new password"
                      placeholderTextColor="#999"
                      secureTextEntry={!showConfirmPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-off' : 'eye'}
                        size={wp(5)}
                        color="#9CA3AF"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={handleChangePassword}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSaveButtonText}>Change Password</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#048E04',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: hp(2),
    fontSize: wp(4),
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
    backgroundColor: '#048E04',
  },
  backButton: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: isSmallDevice ? wp(5) : wp(5.5),
    fontWeight: '700',
    color: '#fff',
  },
  headerRight: {
    width: wp(10),
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    paddingBottom: hp(3),
  },
  profileHeader: {
    backgroundColor: '#048E04',
    alignItems: 'center',
    paddingBottom: hp(4),
  },
  avatarContainer: {
    marginBottom: hp(2),
  },
  avatar: {
    width: wp(28),
    height: wp(28),
    borderRadius: wp(14),
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  profileName: {
    fontSize: isSmallDevice ? wp(5.5) : wp(6),
    fontWeight: '700',
    color: '#fff',
    marginBottom: hp(0.5),
  },
  profileEmail: {
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    color: 'rgba(255, 255, 255, 0.8)',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: wp(5),
    marginTop: hp(2),
    borderRadius: wp(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp(4),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cardTitle: {
    fontSize: isSmallDevice ? wp(4.2) : wp(4.5),
    fontWeight: '700',
    color: '#1a1a1a',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
  },
  editButtonText: {
    fontSize: wp(3.8),
    fontWeight: '600',
    color: '#048E04',
  },
  cardContent: {
    padding: wp(4),
  },
  infoGroup: {
    marginBottom: hp(2.5),
  },
  infoLabel: {
    fontSize: isSmallDevice ? wp(3.2) : wp(3.5),
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: hp(0.8),
  },
  infoValue: {
    fontSize: isSmallDevice ? wp(4) : wp(4.2),
    color: '#1a1a1a',
    fontWeight: '500',
  },
  infoInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: wp(3),
    padding: wp(3.5),
    fontSize: isSmallDevice ? wp(3.8) : wp(4),
    color: '#1a1a1a',
  },
  disabledInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: wp(3),
    padding: wp(3.5),
  },
  disabledInputText: {
    flex: 1,
    fontSize: isSmallDevice ? wp(3.8) : wp(4),
    color: '#9CA3AF',
  },
  lockedBadge: {
    marginLeft: wp(2),
  },
  editActions: {
    flexDirection: 'row',
    gap: wp(3),
    marginTop: hp(1),
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: hp(1.5),
    borderRadius: wp(3),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    fontSize: isSmallDevice ? wp(3.8) : wp(4),
    fontWeight: '700',
    color: '#6B7280',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#048E04',
    paddingVertical: hp(1.5),
    borderRadius: wp(3),
    alignItems: 'center',
    shadowColor: '#048E04',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: isSmallDevice ? wp(3.8) : wp(4),
    fontWeight: '700',
    color: '#fff',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(1.5),
  },
  menuIconContainer: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
  },
  menuItemText: {
    flex: 1,
    fontSize: isSmallDevice ? wp(3.8) : wp(4),
    fontWeight: '600',
    color: '#1a1a1a',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(1.5),
    gap: wp(2),
  },
  logoutButtonText: {
    fontSize: isSmallDevice ? wp(4) : wp(4.2),
    fontWeight: '700',
    color: '#EF4444',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: wp(6),
    borderTopRightRadius: wp(6),
    maxHeight: hp(80),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp(5),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: isSmallDevice ? wp(5) : wp(5.5),
    fontWeight: '700',
    color: '#1a1a1a',
  },
  closeButton: {
    width: wp(9),
    height: wp(9),
    borderRadius: wp(4.5),
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: wp(5),
  },
  modalInputGroup: {
    marginBottom: hp(2.5),
  },
  modalInputLabel: {
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    fontWeight: '600',
    color: '#333',
    marginBottom: hp(0.8),
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: wp(3),
    backgroundColor: '#fff',
  },
  passwordInput: {
    flex: 1,
    padding: wp(3.5),
    fontSize: isSmallDevice ? wp(3.8) : wp(4),
    color: '#1a1a1a',
  },
  eyeButton: {
    padding: wp(3),
  },
  modalSaveButton: {
    backgroundColor: '#048E04',
    paddingVertical: hp(2),
    borderRadius: wp(3),
    alignItems: 'center',
    marginTop: hp(1),
    shadowColor: '#048E04',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  modalSaveButtonText: {
    fontSize: isSmallDevice ? wp(4) : wp(4.2),
    fontWeight: '700',
    color: '#fff',
  },
});

export default ProfileScreen;