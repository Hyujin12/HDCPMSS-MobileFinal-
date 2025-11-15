import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
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
const isLargeDevice = screenWidth >= 414;

// Responsive font sizing
const fontSize = {
  xs: isSmallDevice ? 10 : isMediumDevice ? 11 : 12,
  sm: isSmallDevice ? 12 : isMediumDevice ? 13 : 14,
  base: isSmallDevice ? 14 : isMediumDevice ? 15 : 16,
  lg: isSmallDevice ? 16 : isMediumDevice ? 17 : 18,
  xl: isSmallDevice ? 18 : isMediumDevice ? 20 : 22,
  '2xl': isSmallDevice ? 22 : isMediumDevice ? 24 : 26,
  '3xl': isSmallDevice ? 26 : isMediumDevice ? 28 : 30,
};

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
const BASE_URL = 'https://hdcpmss-mobilefinal-j60e.onrender.com';

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
  const [todayAppointments, setTodayAppointments] = useState([]);

  useEffect(() => {
    checkTokenAndFetch();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  useFocusEffect(
    useCallback(() => {
      const refreshData = async () => {
        try {
          const token = await AsyncStorage.getItem('token');
          if (token) {
            await fetchAppointments(token);
          }
        } catch (err) {
          console.error('❌ Error refreshing data:', err);
        }
      };
      refreshData();
    }, [])
  );

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

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Enable notifications to receive appointment reminders');
    }
  };

  const generateNotifications = (appointments) => {
    const now = new Date();
    const notifs = [];

    appointments.forEach((apt) => {
      const aptDateTime = new Date(`${apt.date}T${apt.time}`);
      const timeDiff = aptDateTime - now;
      const hoursDiff = timeDiff / (1000 * 60 * 60);

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
    });

    notifs.sort((a, b) => b.time - a.time);
    setNotifications(notifs);
    setUnreadCount(notifs.filter(n => !n.read).length);
  };

  const fetchAppointments = async (token) => {
    try {
      console.log('🔹 Fetching user profile first...');
      
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

      const resAppointments = await axios.get(`${BASE_URL}/api/booked-services`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      });

      const allAppointments = resAppointments.data || [];
      
      const userAppointments = allAppointments.filter((apt) => {
        return apt.userId === userId || 
               apt.user === userId || 
               apt.user?._id === userId ||
               apt.createdBy === userId;
      });

      setAppointments(userAppointments);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's appointments
      const todayApts = userAppointments.filter((apt) => {
        const aptDate = new Date(apt.date);
        aptDate.setHours(0, 0, 0, 0);
        return aptDate.getTime() === today.getTime() && 
               !['completed', 'cancelled'].includes(apt.status.toLowerCase());
      });
      setTodayAppointments(todayApts);

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
      console.error('❌ Error fetching appointments:', err);
      Alert.alert('Error', 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

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

  const markAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const getStatusConfig = (status) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'accepted': 
        return { color: '#10B981', bgColor: '#D1FAE5', icon: '✓', label: 'Confirmed' };
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
      case 'completed': return '#EFF6FF';
      case 'today': return '#DBEAFE';
      case 'soon': return '#FEF9C3';
      default: return '#F9FAFB';
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#048E04" />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView 
            style={styles.container}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <View style={styles.clinicInfo}>
                  <View style={styles.logoContainer}>
                    <Image
                      source={require('../assets/halili logo.png')}
                      style={styles.logo}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.clinicTextContainer}>
                    <Text style={styles.clinicName}>Halili's Dental Clinic</Text>
                    <Text style={styles.clinicSubtitle}>Professional Dental Care</Text>
                  </View>
                </View>
                
                <View style={styles.headerActions}>
                  <TouchableOpacity 
                    style={styles.notificationButton}
                    onPress={() => setShowNotifications(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.notificationIcon}>🔔</Text>
                    {unreadCount > 0 && (
                      <View style={styles.notificationBadge}>
                        <Text style={styles.notificationBadgeText}>
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.profileButton} 
                    onPress={() => navigation.navigate('Profile')}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{ uri: 'https://cdn.builder.io/api/v1/image/assets/TEMP/710b09d5dcde3cacc180fc426a3bbdf2b55f80be?apiKey=b83e627850f647aa94da00dc54b22383' }}
                      style={styles.profileImage}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Welcome Section */}
              <View style={styles.welcomeSection}>
                <Text style={styles.greeting}>{getGreeting()},</Text>
                <Text style={styles.userName}>{username}</Text>
                <Text style={styles.welcomeSubtext}>
                  {upcomingAppointments.length > 0 
                    ? `You have ${upcomingAppointments.length} upcoming appointment${upcomingAppointments.length > 1 ? 's' : ''}`
                    : 'Your dental health is our priority'}
                </Text>
              </View>
            </View>

            {/* Today's Appointments Banner */}
            {todayAppointments.length > 0 && (
              <View style={styles.todayBanner}>
                <View style={styles.todayBannerContent}>
                  <View style={styles.todayBannerIcon}>
                    <Text style={styles.todayBannerIconText}>📅</Text>
                  </View>
                  <View style={styles.todayBannerTextContainer}>
                    <Text style={styles.todayBannerTitle}>Today's Appointments</Text>
                    <Text style={styles.todayBannerSubtitle}>
                      {todayAppointments.length} appointment{todayAppointments.length > 1 ? 's' : ''} scheduled
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.todayBannerButton}
                    onPress={() => navigation.navigate('AllAppointments')}
                  >
                    <Text style={styles.todayBannerButtonText}>View</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, styles.statCardPrimary]}>
                <View style={styles.statIconContainer}>
                  <Text style={styles.statIcon}>📊</Text>
                </View>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total Appointments</Text>
              </View>

              <View style={[styles.statCard, styles.statCardWarning]}>
                <View style={styles.statIconContainer}>
                  <Text style={styles.statIcon}>⏳</Text>
                </View>
                <Text style={styles.statValue}>{stats.pending}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>

              <View style={[styles.statCard, styles.statCardSuccess]}>
                <View style={styles.statIconContainer}>
                  <Text style={styles.statIcon}>✓</Text>
                </View>
                <Text style={styles.statValue}>{stats.accepted}</Text>
                <Text style={styles.statLabel}>Confirmed</Text>
              </View>

              <View style={[styles.statCard, styles.statCardInfo]}>
                <View style={styles.statIconContainer}>
                  <Text style={styles.statIcon}>✓</Text>
                </View>
                <Text style={styles.statValue}>{stats.completed}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickActions}>
                <TouchableOpacity 
                  style={[styles.actionCard, styles.actionCardBook]}
                  onPress={() => navigation.navigate('BookAppointment')}
                  activeOpacity={0.8}
                >
                  <View style={styles.actionIconWrapper}>
                    <Text style={styles.actionIcon}>📅</Text>
                  </View>
                  <Text style={styles.actionTitle}>Book Appointment</Text>
                  <Text style={styles.actionDescription}>Schedule your visit</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionCard, styles.actionCardView]}
                  onPress={() => navigation.navigate('AllAppointments')}
                  activeOpacity={0.8}
                >
                  <View style={styles.actionIconWrapper}>
                    <Text style={styles.actionIcon}>📋</Text>
                  </View>
                  <Text style={styles.actionTitle}>My Appointments</Text>
                  <Text style={styles.actionDescription}>View all bookings</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Upcoming Appointments */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
                {upcomingAppointments.length > 2 && (
                  <TouchableOpacity 
                    onPress={() => navigation.navigate('AllAppointments')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.viewAllText}>View All →</Text>
                  </TouchableOpacity>
                )}
              </View>

              {upcomingAppointments.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyStateIcon}>
                    <Text style={styles.emptyStateIconText}>📅</Text>
                  </View>
                  <Text style={styles.emptyStateTitle}>No Upcoming Appointments</Text>
                  <Text style={styles.emptyStateDescription}>
                    Book your next dental checkup to maintain optimal oral health
                  </Text>
                  <TouchableOpacity 
                    style={styles.emptyStateButton}
                    onPress={() => navigation.navigate('BookAppointment')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emptyStateButtonText}>Book Now</Text>
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
                      <View style={styles.appointmentCardHeader}>
                        <View style={styles.appointmentIconCircle}>
                          <Text style={styles.appointmentIcon}>🦷</Text>
                        </View>
                        <View style={styles.appointmentCardHeaderInfo}>
                          <Text style={styles.appointmentService}>{appointment.serviceName}</Text>
                          <Text style={styles.appointmentPatient}>👤 {appointment.username}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                          <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                            {statusConfig.label}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.appointmentCardFooter}>
                        <View style={styles.appointmentDetail}>
                          <Text style={styles.appointmentDetailIcon}>📅</Text>
                          <Text style={styles.appointmentDetailText}>
                            {new Date(appointment.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Text>
                        </View>
                        <View style={styles.appointmentDetail}>
                          <Text style={styles.appointmentDetailIcon}>🕐</Text>
                          <Text style={styles.appointmentDetailText}>{appointment.time}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {/* Health Tips */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Dental Care Tips</Text>
                <Text style={styles.tipsEmoji}>💡</Text>
              </View>
              <View style={styles.tipsCard}>
                <View style={styles.tipItem}>
                  <View style={styles.tipIconContainer}>
                    <Text style={styles.tipIcon}>🪥</Text>
                  </View>
                  <Text style={styles.tipText}>Brush twice daily for at least 2 minutes</Text>
                </View>
                <View style={styles.tipItem}>
                  <View style={styles.tipIconContainer}>
                    <Text style={styles.tipIcon}>🧵</Text>
                  </View>
                  <Text style={styles.tipText}>Floss daily to remove plaque between teeth</Text>
                </View>
                <View style={styles.tipItem}>
                  <View style={styles.tipIconContainer}>
                    <Text style={styles.tipIcon}>🥤</Text>
                  </View>
                  <Text style={styles.tipText}>Limit sugary drinks and acidic foods</Text>
                </View>
                <View style={styles.tipItem}>
                  <View style={styles.tipIconContainer}>
                    <Text style={styles.tipIcon}>👨‍⚕️</Text>
                  </View>
                  <Text style={styles.tipText}>Visit your dentist every 6 months</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </Animated.View>

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
                <View style={styles.modalHeaderActions}>
                  {unreadCount > 0 && (
                    <TouchableOpacity 
                      onPress={markAllAsRead}
                      style={styles.markAllButton}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.markAllButtonText}>Mark all read</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    onPress={() => setShowNotifications(false)}
                    style={styles.closeModalButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.closeModalButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView 
                style={styles.notificationsList}
                showsVerticalScrollIndicator={false}
              >
                {notifications.length === 0 ? (
                  <View style={styles.emptyNotifications}>
                    <View style={styles.emptyNotificationsIcon}>
                      <Text style={styles.emptyNotificationsIconText}>🔔</Text>
                    </View>
                    <Text style={styles.emptyNotificationsTitle}>No Notifications</Text>
                    <Text style={styles.emptyNotificationsText}>
                      You're all caught up! Check back later for updates.
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
                      {!notif.read && <View style={styles.unreadIndicator} />}
                      <View style={styles.notificationItemContent}>
                        <Text style={styles.notificationItemTitle}>{notif.title}</Text>
                        <Text style={styles.notificationItemMessage}>{notif.message}</Text>
                        <Text style={styles.notificationItemTime}>
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
  loadingText: {
    marginTop: 16,
    fontSize: fontSize.base,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Main Container
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    paddingBottom: hp(3),
  },

  // Header
  header: {
    backgroundColor: '#fff',
    paddingTop: hp(2),
    paddingBottom: hp(2.5),
    borderBottomLeftRadius: wp(6),
    borderBottomRightRadius: wp(6),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    marginBottom: hp(2),
  },
  clinicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#048E04',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logo: {
    width: wp(8),
    height: wp(8),
  },
  clinicTextContainer: {
    marginLeft: wp(3),
    flex: 1,
  },
  clinicName: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  clinicSubtitle: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: '#048E04',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
  },
  notificationButton: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(5.5),
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationIcon: {
    fontSize: wp(5.5),
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
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
  notificationBadgeText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  profileButton: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(5.5),
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
  },
  greeting: {
    fontSize: fontSize.base,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  userName: {
    fontSize: fontSize['3xl'],
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  welcomeSubtext: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    fontWeight: '400',
  },

  // Today's Banner
  todayBanner: {
    marginHorizontal: wp(5),
    marginTop: hp(2),
    backgroundColor: '#EFF6FF',
    borderRadius: wp(4),
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    overflow: 'hidden',
  },
  todayBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp(4),
  },
  todayBannerIcon: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
  },
  todayBannerIconText: {
    fontSize: wp(6),
  },
  todayBannerTextContainer: {
    flex: 1,
  },
  todayBannerTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  todayBannerSubtitle: {
    fontSize: fontSize.sm,
    color: '#6B7280',
  },
  todayBannerButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    borderRadius: wp(2),
  },
  todayBannerButtonText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: wp(5),
    marginTop: hp(2.5),
    gap: wp(2.5),
  },
  statCard: {
    flex: 4,
    backgroundColor: '#fff',
    borderRadius: wp(3.5),
    paddingVertical: hp(2),
    paddingHorizontal: wp(2),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    minHeight: hp(11),
  },
  statCardPrimary: {
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
  },
  statCardWarning: {
    borderColor: '#FEF3C7',
    backgroundColor: '#FFFBEB',
  },
  statCardSuccess: {
    borderColor: '#D1FAE5',
    backgroundColor: '#ECFDF5',
  },
  statCardInfo: {
    borderColor: '#E9D5FF',
    backgroundColor: '#F5F3FF',
  },
  statIconContainer: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(0.8),
  },
  statIcon: {
    fontSize: wp(5.5),
  },
  statValue: {
    fontSize: isSmallDevice ? fontSize.xl : fontSize['2xl'],
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: isSmallDevice ? 9 : fontSize.xs,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: isSmallDevice ? 12 : 14,
  },

  // Section
  section: {
    paddingHorizontal: wp(5),
    marginTop: hp(3),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: '#1F2937',
  },
  viewAllText: {
    fontSize: fontSize.sm,
    color: '#048E04',
    fontWeight: '600',
  },
  tipsEmoji: {
    fontSize: wp(5),
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: wp(3),
  },
  actionCard: {
    flex: 1,
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
  },
  actionCardBook: {
    borderColor: '#D1FAE5',
    backgroundColor: '#ECFDF5',
  },
  actionCardView: {
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
  },
  actionIconWrapper: {
    width: wp(16),
    height: wp(16),
    borderRadius: wp(8),
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(1.5),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    fontSize: wp(8),
  },
  actionTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: fontSize.xs,
    color: '#6B7280',
    textAlign: 'center',
  },

  // Appointment Card
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: wp(4),
    padding: wp(4),
    marginBottom: hp(1.5),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  appointmentCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: hp(1.5),
  },
  appointmentIconCircle: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
  },
  appointmentIcon: {
    fontSize: wp(6),
  },
  appointmentCardHeaderInfo: {
    flex: 1,
  },
  appointmentService: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  appointmentPatient: {
    fontSize: fontSize.sm,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.6),
    borderRadius: wp(2),
  },
  statusBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  appointmentCardFooter: {
    flexDirection: 'row',
    gap: wp(4),
    paddingTop: hp(1.5),
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  appointmentDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appointmentDetailIcon: {
    fontSize: wp(4),
    marginRight: wp(1.5),
  },
  appointmentDetailText: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Empty State
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: wp(4),
    padding: wp(6),
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    borderStyle: 'dashed',
  },
  emptyStateIcon: {
    width: wp(20),
    height: wp(20),
    borderRadius: wp(10),
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  emptyStateIconText: {
    fontSize: wp(10),
  },
  emptyStateTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp(1),
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: hp(2.5),
    lineHeight: 20,
    paddingHorizontal: wp(4),
  },
  emptyStateButton: {
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
  emptyStateButtonText: {
    color: '#fff',
    fontSize: fontSize.base,
    fontWeight: '700',
  },

  // Tips Card
  tipsCard: {
    backgroundColor: '#fff',
    borderRadius: wp(4),
    padding: wp(4),
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
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  tipIconContainer: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#FFFBEB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
  },
  tipIcon: {
    fontSize: wp(5),
  },
  tipText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: '#374151',
    lineHeight: 20,
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
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalHeaderActions: {
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
  markAllButtonText: {
    color: '#048E04',
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  closeModalButton: {
    width: wp(8),
    height: wp(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalButtonText: {
    fontSize: wp(6),
    color: '#6B7280',
  },
  notificationsList: {
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
  },
  unreadIndicator: {
    width: wp(2),
    height: wp(2),
    borderRadius: wp(1),
    backgroundColor: '#048E04',
    marginRight: wp(3),
    marginTop: hp(0.8),
  },
  notificationItemContent: {
    flex: 1,
  },
  notificationItemTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  notificationItemMessage: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    marginBottom: hp(0.8),
    lineHeight: 20,
  },
  notificationItemTime: {
    fontSize: fontSize.xs,
    color: '#9CA3AF',
  },
  emptyNotifications: {
    alignItems: 'center',
    paddingVertical: hp(8),
  },
  emptyNotificationsIcon: {
    width: wp(24),
    height: wp(24),
    borderRadius: wp(12),
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  emptyNotificationsIconText: {
    fontSize: wp(12),
  },
  emptyNotificationsTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp(0.8),
  },
  emptyNotificationsText: {
    fontSize: fontSize.sm,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: wp(8),
  },
});

export default HomeScreen;