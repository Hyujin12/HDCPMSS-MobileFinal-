import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// -------------------------
// Responsive helpers
// -------------------------
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const wp = (percentage) => (screenWidth * percentage) / 100;
const hp = (percentage) => (screenHeight * percentage) / 100;
const isSmallDevice = screenWidth < 375;
const isMediumDevice = screenWidth >= 375 && screenWidth < 414;

// -------------------------
// Notification handler
// -------------------------
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// -------------------------
// Backend BASE_URL
// -------------------------
const BASE_URL = 'https://hdcpmss-mobilefinal.onrender.com';

const HomeScreen = ({ navigation }) => {
  const [appointments, setAppointments] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, accepted: 0, completed: 0 });
  const [username, setUsername] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    checkTokenAndFetch();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  // -------------------------
  // Check token & fetch data
  // -------------------------
  const checkTokenAndFetch = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      console.log('✅ Retrieved token:', token);

      if (!token) {
        Alert.alert('Session Expired', 'Please log in again.');
        navigation.replace('LoginScreen');
        return;
      }

      await requestNotificationPermissions();
      await fetchAppointments(token);
    } catch (err) {
      console.error('❌ Error in checkTokenAndFetch:', err);
      Alert.alert('Error', 'Something went wrong.');
      navigation.replace('LoginScreen');
    }
  };

  // -------------------------
  // Notification permission
  // -------------------------
  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Enable notifications to receive appointment reminders');
    }
  };

  // -------------------------
  // Generate notifications based on appointments
  // -------------------------
  const generateNotifications = (appointments) => {
    const now = new Date();
    const notifs = [];

    appointments.forEach((apt) => {
      const aptDateTime = new Date(`${apt.date}T${apt.time}`);
      const timeDiff = aptDateTime - now;
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      // Status change notifications
      if (apt.status.toLowerCase() === 'accepted') {
        notifs.push({
          id: `${apt._id}-accepted`,
          type: 'accepted',
          title: '✅ Appointment Accepted',
          message: `Your appointment for ${apt.serviceName} on ${new Date(apt.date).toLocaleDateString()} at ${apt.time} has been accepted.`,
          time: new Date(apt.updatedAt || apt.createdAt),
          appointmentId: apt._id,
          read: false,
        });
      }

      if (apt.status.toLowerCase() === 'cancelled') {
        notifs.push({
          id: `${apt._id}-cancelled`,
          type: 'cancelled',
          title: '❌ Appointment Cancelled',
          message: `Your appointment for ${apt.serviceName} on ${new Date(apt.date).toLocaleDateString()} has been cancelled.`,
          time: new Date(apt.updatedAt || apt.createdAt),
          appointmentId: apt._id,
          read: false,
        });
      }

      if (apt.status.toLowerCase() === 'rescheduled') {
        notifs.push({
          id: `${apt._id}-rescheduled`,
          type: 'rescheduled',
          title: '🔄 Appointment Rescheduled',
          message: `Your appointment for ${apt.serviceName} has been rescheduled to ${new Date(apt.date).toLocaleDateString()} at ${apt.time}.`,
          time: new Date(apt.updatedAt || apt.createdAt),
          appointmentId: apt._id,
          read: false,
        });
      }

      if (apt.status.toLowerCase() === 'completed') {
        notifs.push({
          id: `${apt._id}-completed`,
          type: 'completed',
          title: '✅ Appointment Completed',
          message: `Your appointment for ${apt.serviceName} has been completed. Tap to view receipt.`,
          time: new Date(apt.updatedAt || apt.createdAt),
          appointmentId: apt._id,
          read: false,
          navigateTo: 'Receipt',
        });
      }

      // Today's appointment
      if (hoursDiff >= 0 && hoursDiff <= 24 && hoursDiff > 1) {
        notifs.push({
          id: `${apt._id}-today`,
          type: 'today',
          title: '📅 Appointment Today',
          message: `You have an appointment for ${apt.serviceName} today at ${apt.time}.`,
          time: new Date(),
          appointmentId: apt._id,
          read: false,
        });
      }

      // 1 hour before
      if (hoursDiff > 0 && hoursDiff <= 1) {
        notifs.push({
          id: `${apt._id}-soon`,
          type: 'soon',
          title: '⏰ Appointment in 1 Hour',
          message: `Your appointment for ${apt.serviceName} is in less than 1 hour at ${apt.time}.`,
          time: new Date(),
          appointmentId: apt._id,
          read: false,
        });
      }

      // Missed appointment
      if (hoursDiff < 0 && hoursDiff > -24 && apt.status.toLowerCase() !== 'completed' && apt.status.toLowerCase() !== 'cancelled') {
        notifs.push({
          id: `${apt._id}-missed`,
          type: 'missed',
          title: '⚠️ Missed Appointment',
          message: `You missed your appointment for ${apt.serviceName} scheduled at ${apt.time} on ${new Date(apt.date).toLocaleDateString()}.`,
          time: new Date(),
          appointmentId: apt._id,
          read: false,
        });
      }
    });

    notifs.sort((a, b) => b.time - a.time);
    setNotifications(notifs);
    setUnreadCount(notifs.filter(n => !n.read).length);
  };

  // -------------------------
  // Fetch appointments & user info
  // -------------------------
  // -------------------------
// Fetch appointments & user info
// -------------------------
const fetchAppointments = async (token) => {
  try {
    console.log('🔹 Fetching user profile first...');
    
    // First, get the user profile to obtain userId
    const resProfile = await axios.get(`${BASE_URL}/api/users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });
    
    console.log('✅ Profile response:', resProfile.data);
    const userId = resProfile.data._id || resProfile.data.id;
    setUsername(resProfile.data.username || 'User');

    if (!userId) {
      throw new Error('User ID not found in profile');
    }

    console.log('🔹 Sending GET request to:', `${BASE_URL}/api/booked-services`);
    console.log('🔹 Request headers:', { Authorization: `Bearer ${token}` });

    // Fetch all appointments
    const resAppointments = await axios.get(`${BASE_URL}/api/booked-services`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });

    console.log('✅ Appointments response:', resAppointments.data);
    const allAppointments = resAppointments.data || [];
    
    // Filter appointments for the logged-in user
    // This assumes appointments have a userId or user field that matches the logged-in user
    const userAppointments = allAppointments.filter((apt) => {
      // Check various possible field names for user identification
      return apt.userId === userId || 
             apt.user === userId || 
             apt.user?._id === userId ||
             apt.createdBy === userId;
    });

    console.log(`📊 Filtered ${userAppointments.length} appointments out of ${allAppointments.length} total`);
    setAppointments(userAppointments);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = userAppointments
      .filter((apt) => {
        const aptDateTime = new Date(`${apt.date}T${apt.time}`);
        return aptDateTime >= today && !['completed', 'cancelled'].includes(apt.status.toLowerCase());
      })
      .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

    setUpcomingAppointments(upcoming);

    const stats = {
      total: userAppointments.length,
      pending: userAppointments.filter((a) => a.status.toLowerCase() === 'pending').length,
      accepted: userAppointments.filter((a) => a.status.toLowerCase() === 'accepted').length,
      completed: userAppointments.filter((a) => a.status.toLowerCase() === 'completed').length,
    };
    setStats(stats);

    generateNotifications(userAppointments);
    scheduleNotifications(upcoming);
  } catch (err) {
    if (err.response) {
      console.error('❌ Axios response error:', err.response.status, err.response.data);
    } else if (err.request) {
      console.error('❌ Axios no response:', err.request);
    } else {
      console.error('❌ Axios setup error:', err.message);
    }

    Alert.alert('Error', 'Failed to load appointments or user info');
  } finally {
    setLoading(false);
  }
};

  // -------------------------
  // Schedule notifications
  // -------------------------
  const scheduleNotifications = async (appointments) => {
    await Notifications.cancelAllScheduledNotificationsAsync();

    appointments.forEach(async (apt) => {
      if (!apt.time) return;

      const aptDateTime = new Date(`${apt.date}T${apt.time}`);
      if (isNaN(aptDateTime.getTime())) return;

      const now = new Date();

      const oneDayBefore = new Date(aptDateTime.getTime() - 24 * 60 * 60 * 1000);
      if (oneDayBefore > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '📅 Appointment Reminder',
            body: `Tomorrow: ${apt.serviceName} at ${apt.time}`,
            data: { appointmentId: apt._id },
          },
          trigger: oneDayBefore,
        });
      }

      const oneHourBefore = new Date(aptDateTime.getTime() - 60 * 60 * 1000);
      if (oneHourBefore > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⏰ Appointment Soon!',
            body: `${apt.serviceName} in 1 hour at ${apt.time}`,
            data: { appointmentId: apt._id },
          },
          trigger: oneHourBefore,
        });
      }
    });
  };

  // -------------------------
  // Mark notification as read
  // -------------------------
  const markAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // -------------------------
  // Mark all as read
  // -------------------------
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  // -------------------------
  // UI helpers
  // -------------------------
  const getStatusConfig = (status) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'accepted': 
        return { color: '#10B981', bgColor: '#D1FAE5', icon: '✓', label: 'Accepted' };
      case 'pending': 
        return { color: '#F59E0B', bgColor: '#FEF3C7', icon: '⏳', label: 'Pending' };
      case 'completed': 
        return { color: '#3B82F6', bgColor: '#DBEAFE', icon: '✓', label: 'Completed' };
      case 'cancelled': 
        return { color: '#EF4444', bgColor: '#FEE2E2', icon: '✗', label: 'Cancelled' };
      default: 
        return { color: '#6B7280', bgColor: '#F3F4F6', icon: '•', label: status };
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'accepted': return '#ECFDF5';
      case 'cancelled': return '#FEF2F2';
      case 'rescheduled': return '#FEF3C7';
      case 'completed': return '#EFF6FF';
      case 'today': return '#DBEAFE';
      case 'soon': return '#FEF9C3';
      case 'missed': return '#FEE2E2';
      default: return '#F9FAFB';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#048E04" />
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.safeArea}>
        <Animated.ScrollView 
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.headerContainer}>
            <View style={styles.clinicInfo}>
              <View style={styles.logoWrapper}>
                <Image
                  source={require('../assets/halili logo.png')}
                  style={styles.clinicLogo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.clinicTextContainer}>
                <Text style={styles.clinicName}>Halili's Dental Clinic</Text>
                <Text style={styles.clinicTagline}>Professional Care</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity 
                style={styles.notificationButton}
                onPress={() => setShowNotifications(true)}
                activeOpacity={0.7}
              >
                <View style={styles.notificationIconWrapper}>
                  <Text style={styles.bellIcon}>🔔</Text>
                  {unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.profileButton} 
                onPress={() => navigation.navigate('Profile')}
                activeOpacity={0.7}
              >
                <View style={styles.profileContainer}>
                  <Image
                    source={{ uri: 'https://cdn.builder.io/api/v1/image/assets/TEMP/710b09d5dcde3cacc180fc426a3bbdf2b55f80be?apiKey=b83e627850f647aa94da00dc54b22383' }}
                    style={styles.profileImage}
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.greetingText}>Hello, {username}! 👋</Text>
            <Text style={styles.subtitleText}>Let's start your day with a smile</Text>
          </View>

          {/* Quick Stats */}
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, styles.statCardTotal]}>
              <View style={styles.statIconContainer}>
                <Text style={styles.statIcon}>📊</Text>
              </View>
              <Text style={styles.statNumber}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={[styles.statCard, styles.statCardPending]}>
              <View style={styles.statIconContainer}>
                <Text style={styles.statIcon}>⏳</Text>
              </View>
              <Text style={styles.statNumber}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={[styles.statCard, styles.statCardAccepted]}>
              <View style={styles.statIconContainer}>
                <Text style={styles.statIcon}>✓</Text>
              </View>
              <Text style={styles.statNumber}>{stats.accepted}</Text>
              <Text style={styles.statLabel}>Accepted</Text>
            </View>
            <View style={[styles.statCard, styles.statCardCompleted]}>
              <View style={styles.statIconContainer}>
                <Text style={styles.statIcon}>✓</Text>
              </View>
              <Text style={styles.statNumber}>{stats.completed}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity 
                style={styles.actionCard} 
                onPress={() => navigation.navigate('BookAppointment')}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: '#ECFDF5' }]}>
                  <Text style={styles.actionIcon}>📅</Text>
                </View>
                <Text style={styles.actionText}>Book</Text>
                <Text style={styles.actionSubtext}>New Appointment</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionCard} 
                onPress={() => navigation.navigate('AllAppointments')}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: '#EFF6FF' }]}>
                  <Text style={styles.actionIcon}>📋</Text>
                </View>
                <Text style={styles.actionText}>View All</Text>
                <Text style={styles.actionSubtext}>Appointments</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionCard} 
                onPress={() => navigation.navigate('Services')}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={styles.actionIcon}>🦷</Text>
                </View>
                <Text style={styles.actionText}>Services</Text>
                <Text style={styles.actionSubtext}>Our Offerings</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionCard} 
                onPress={() => navigation.navigate('History')}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: '#F3E5F5' }]}>
                  <Text style={styles.actionIcon}>📜</Text>
                </View>
                <Text style={styles.actionText}>History</Text>
                <Text style={styles.actionSubtext}>Past Records</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Upcoming Appointments */}
          <View style={styles.appointmentsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
              {upcomingAppointments.length > 0 && (
                <TouchableOpacity 
                  onPress={() => navigation.navigate('AllAppointments')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.seeAllText}>See All →</Text>
                </TouchableOpacity>
              )}
            </View>

            {upcomingAppointments.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIconContainer}>
                  <Text style={styles.emptyStateIcon}>📅</Text>
                </View>
                <Text style={styles.emptyStateTitle}>No Upcoming Appointments</Text>
                <Text style={styles.emptyStateText}>
                  Schedule your next dental visit today
                </Text>
                <TouchableOpacity 
                  style={styles.bookNowButton} 
                  onPress={() => navigation.navigate('BookAppointment')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.bookNowText}>Book Appointment</Text>
                </TouchableOpacity>
              </View>
            ) : (
              upcomingAppointments.slice(0, 3).map((appointment) => {
                const statusConfig = getStatusConfig(appointment.status);
                return (
                  <TouchableOpacity
                    key={appointment._id}
                    style={styles.appointmentCard}
                    onPress={() => navigation.navigate('AppointmentDetails', { appointment })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.appointmentIconContainer}>
                      <Text style={styles.appointmentTypeIcon}>🦷</Text>
                    </View>
                    <View style={styles.appointmentInfo}>
                      <Text style={styles.appointmentTitle}>{appointment.serviceName}</Text>
                      <View style={styles.appointmentMetaRow}>
                        <Text style={styles.appointmentMeta}>
                          📅 {new Date(appointment.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                        <Text style={styles.appointmentMeta}>🕐 {appointment.time}</Text>
                      </View>
                      <Text style={styles.appointmentPatient}>👤 {appointment.username}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                        <Text style={[styles.statusText, { color: statusConfig.color }]}>
                          {statusConfig.icon} {statusConfig.label}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Dental Care Tips */}
          <View style={styles.tipsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Dental Care Tips</Text>
              <Text style={styles.tipsBadge}>💡</Text>
            </View>
            <View style={styles.tipCard}>
              <View style={styles.tipItem}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>Brush twice daily for 2 minutes</Text>
              </View>
              <View style={styles.tipItem}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>Floss at least once a day</Text>
              </View>
              <View style={styles.tipItem}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>Visit your dentist every 6 months</Text>
              </View>
              <View style={styles.tipItem}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>Limit sugary foods and drinks</Text>
              </View>
            </View>
          </View>
        </Animated.ScrollView>

        {/* Notification Modal */}
        <Modal
          visible={showNotifications}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowNotifications(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Notifications</Text>
                <View style={styles.modalHeaderRight}>
                  {unreadCount > 0 && (
                    <TouchableOpacity 
                      onPress={markAllAsRead} 
                      style={styles.markAllButton}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.markAllText}>Mark all read</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    onPress={() => setShowNotifications(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.closeButton}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView 
                style={styles.notificationList}
                showsVerticalScrollIndicator={false}
              >
                {notifications.length === 0 ? (
                  <View style={styles.emptyNotifications}>
                    <View style={styles.emptyNotificationIconContainer}>
                      <Text style={styles.emptyNotificationsIcon}>🔔</Text>
                    </View>
                    <Text style={styles.emptyNotificationsTitle}>No Notifications</Text>
                    <Text style={styles.emptyNotificationsText}>
                      You're all caught up!
                    </Text>
                  </View>
                ) : (
                  notifications.map((notif) => (
                    <TouchableOpacity
                      key={notif.id}
                      style={[
                        styles.notificationItem,
                        { backgroundColor: notif.read ? '#fff' : getNotificationColor(notif.type) }
                      ]}
                      onPress={() => {
                        markAsRead(notif.id);
                        const appointment = appointments.find(a => a._id === notif.appointmentId);
                        setShowNotifications(false);
                        
                        if (notif.navigateTo === 'Receipt') {
                          navigation.navigate('Receipt', { appointment });
                        } else if (appointment) {
                          navigation.navigate('AppointmentDetails', { appointment });
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      {!notif.read && <View style={styles.unreadDot} />}
                      <View style={styles.notificationContent}>
                        <Text style={styles.notificationTitle}>{notif.title}</Text>
                        <Text style={styles.notificationMessage}>{notif.message}</Text>
                        <Text style={styles.notificationTime}>
                          {notif.time.toLocaleDateString()} • {notif.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  // Loading
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: hp(2),
    fontSize: isSmallDevice ? wp(3.8) : wp(4),
    color: '#6B7280',
    fontWeight: '500',
  },

  // Main Container
  safeArea: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  container: { 
    flex: 1, 
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    paddingBottom: hp(3),
  },

  // Header
  headerContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingTop: hp(2),
    paddingBottom: hp(2),
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  clinicInfo: { 
    flexDirection: 'row', 
    alignItems: 'center',
    flex: 1,
  },
  logoWrapper: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(5.5),
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#048E04',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clinicLogo: { 
    width: wp(7), 
    height: wp(7),
  },
  clinicTextContainer: {
    marginLeft: wp(3),
    flex: 1,
  },
  clinicName: { 
    fontSize: isSmallDevice ? wp(3.8) : wp(4.2),
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  clinicTagline: {
    fontSize: isSmallDevice ? wp(2.8) : wp(3),
    fontWeight: '500',
    color: '#048E04',
    marginTop: hp(0.2),
  },
  headerRight: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: wp(3),
  },
  notificationButton: { 
    position: 'relative',
  },
  notificationIconWrapper: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellIcon: { 
    fontSize: wp(5.5),
  },
  badge: { 
    position: 'absolute', 
    top: -hp(0.5), 
    right: -wp(1), 
    backgroundColor: '#EF4444', 
    borderRadius: wp(2.5), 
    minWidth: wp(5), 
    height: wp(5), 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: wp(1),
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: { 
    color: '#fff', 
    fontSize: isSmallDevice ? wp(2.5) : wp(2.8), 
    fontWeight: '700',
  },
  profileButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  profileContainer: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#048E04',
  },
  profileImage: { 
    width: '100%', 
    height: '100%',
  },

  // Welcome Section
  welcomeSection: {
    paddingHorizontal: wp(5),
    paddingTop: hp(3),
    paddingBottom: hp(2),
    backgroundColor: '#fff',
  },
  greetingText: { 
    fontSize: isSmallDevice ? wp(6.5) : wp(7),
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  subtitleText: { 
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    color: '#6B7280',
    marginTop: hp(0.8),
    fontWeight: '400',
  },

  // Stats Container
  statsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    paddingHorizontal: wp(5),
    paddingTop: hp(2),
    paddingBottom: hp(2),
    gap: wp(2),
  },
  statCard: { 
    flex: 1,
    paddingVertical: hp(2),
    paddingHorizontal: wp(2),
    borderRadius: wp(3),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
  },
  statCardTotal: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
  },
  statCardPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FEF3C7',
  },
  statCardAccepted: {
    backgroundColor: '#ECFDF5',
    borderColor: '#D1FAE5',
  },
  statCardCompleted: {
    backgroundColor: '#F5F3FF',
    borderColor: '#E9D5FF',
  },
  statIconContainer: {
    marginBottom: hp(0.8),
  },
  statIcon: {
    fontSize: wp(6),
  },
  statNumber: { 
    fontSize: isSmallDevice ? wp(6) : wp(7),
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: { 
    fontSize: isSmallDevice ? wp(2.8) : wp(3),
    color: '#6B7280',
    marginTop: hp(0.5),
    fontWeight: '500',
  },

  // Actions Section
  actionsSection: {
    paddingHorizontal: wp(5),
    paddingTop: hp(3),
  },
  sectionTitle: { 
    fontSize: isSmallDevice ? wp(4.5) : wp(5),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp(1.5),
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: wp(3),
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: wp(4),
    padding: wp(4),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  actionIconContainer: {
    width: wp(14),
    height: wp(14),
    borderRadius: wp(7),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  actionIcon: { 
    fontSize: wp(7),
  },
  actionText: { 
    fontSize: isSmallDevice ? wp(3.8) : wp(4),
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  actionSubtext: {
    fontSize: isSmallDevice ? wp(2.8) : wp(3),
    color: '#6B7280',
    marginTop: hp(0.3),
    textAlign: 'center',
  },

  // Appointments Section
  appointmentsSection: {
    paddingHorizontal: wp(5),
    paddingTop: hp(3),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  seeAllText: { 
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    color: '#048E04',
    fontWeight: '600',
  },
  appointmentCard: { 
    flexDirection: 'row', 
    alignItems: 'flex-start',
    padding: wp(4),
    backgroundColor: '#fff',
    borderRadius: wp(4),
    marginBottom: hp(1.5),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  appointmentIconContainer: { 
    width: wp(13),
    height: wp(13),
    borderRadius: wp(6.5),
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
  },
  appointmentTypeIcon: {
    fontSize: wp(6),
  },
  appointmentInfo: { 
    flex: 1,
  },
  appointmentTitle: { 
    fontSize: isSmallDevice ? wp(4) : wp(4.3),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp(0.8),
  },
  appointmentMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(3),
    marginBottom: hp(0.5),
  },
  appointmentMeta: { 
    fontSize: isSmallDevice ? wp(3.2) : wp(3.5),
    color: '#6B7280',
    fontWeight: '500',
  },
  appointmentPatient: { 
    fontSize: isSmallDevice ? wp(3.2) : wp(3.5),
    color: '#6B7280',
    marginBottom: hp(1),
  },
  statusBadge: { 
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.6),
    borderRadius: wp(2),
    alignSelf: 'flex-start',
  },
  statusText: { 
    fontSize: isSmallDevice ? wp(2.8) : wp(3),
    fontWeight: '700',
  },

  // Empty State
  emptyState: { 
    alignItems: 'center',
    paddingVertical: hp(4),
    backgroundColor: '#fff',
    borderRadius: wp(4),
    borderWidth: 2,
    borderColor: '#F3F4F6',
    borderStyle: 'dashed',
  },
  emptyStateIconContainer: {
    width: wp(20),
    height: wp(20),
    borderRadius: wp(10),
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  emptyStateIcon: { 
    fontSize: wp(12),
  },
  emptyStateTitle: {
    fontSize: isSmallDevice ? wp(4.5) : wp(5),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp(0.8),
  },
  emptyStateText: { 
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    color: '#6B7280',
    marginBottom: hp(2.5),
    textAlign: 'center',
    paddingHorizontal: wp(5),
  },
  bookNowButton: { 
    backgroundColor: '#048E04',
    paddingHorizontal: wp(8),
    paddingVertical: hp(1.5),
    borderRadius: wp(3),
    shadowColor: '#048E04',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookNowText: { 
    color: '#fff',
    fontWeight: '700',
    fontSize: isSmallDevice ? wp(3.8) : wp(4),
  },

  // Tips Section
  tipsSection: {
    paddingHorizontal: wp(5),
    paddingTop: hp(3),
    paddingBottom: hp(2),
  },
  tipsBadge: {
    fontSize: wp(5),
  },
  tipCard: { 
    backgroundColor: '#FFFBEB',
    padding: wp(4),
    borderRadius: wp(4),
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: hp(1),
  },
  tipBullet: {
    fontSize: isSmallDevice ? wp(4) : wp(4.5),
    color: '#F59E0B',
    fontWeight: '700',
    marginRight: wp(2),
    lineHeight: wp(5.5),
  },
  tipText: { 
    flex: 1,
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    lineHeight: wp(5.5),
    color: '#374151',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: wp(6),
    borderTopRightRadius: wp(6),
    maxHeight: hp(85),
    paddingBottom: hp(2),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(2.5),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: isSmallDevice ? wp(5) : wp(5.5),
    fontWeight: '700',
    color: '#1F2937',
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
  },
  markAllButton: {
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.8),
    backgroundColor: '#F0FDF4',
    borderRadius: wp(2),
  },
  markAllText: {
    color: '#048E04',
    fontSize: isSmallDevice ? wp(3.2) : wp(3.5),
    fontWeight: '600',
  },
  closeButton: {
    fontSize: wp(6),
    color: '#6B7280',
    fontWeight: '400',
  },
  notificationList: {
    paddingHorizontal: wp(5),
    paddingTop: hp(1),
  },
  notificationItem: {
    flexDirection: 'row',
    padding: wp(4),
    borderRadius: wp(3),
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  unreadDot: {
    width: wp(2),
    height: wp(2),
    borderRadius: wp(1),
    backgroundColor: '#048E04',
    marginRight: wp(3),
    marginTop: hp(0.8),
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: isSmallDevice ? wp(3.8) : wp(4),
    fontWeight: '700',
    marginBottom: hp(0.5),
    color: '#1F2937',
  },
  notificationMessage: {
    fontSize: isSmallDevice ? wp(3.3) : wp(3.5),
    color: '#6B7280',
    marginBottom: hp(1),
    lineHeight: wp(5),
  },
  notificationTime: {
    fontSize: isSmallDevice ? wp(2.8) : wp(3),
    color: '#9CA3AF',
  },
  emptyNotifications: {
    alignItems: 'center',
    paddingVertical: hp(8),
  },
  emptyNotificationIconContainer: {
    width: wp(24),
    height: wp(24),
    borderRadius: wp(12),
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  emptyNotificationsIcon: {
    fontSize: wp(12),
  },
  emptyNotificationsTitle: {
    fontSize: isSmallDevice ? wp(4.5) : wp(5),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp(0.8),
  },
  emptyNotificationsText: {
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

export default HomeScreen;