import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
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
const isMediumDevice = screenWidth >= 375 && screenWidth < 414;

const fontSize = {
  xs: isSmallDevice ? 10 : isMediumDevice ? 11 : 12,
  sm: isSmallDevice ? 12 : isMediumDevice ? 13 : 14,
  base: isSmallDevice ? 14 : isMediumDevice ? 15 : 16,
  lg: isSmallDevice ? 16 : isMediumDevice ? 17 : 18,
  xl: isSmallDevice ? 18 : isMediumDevice ? 20 : 22,
};

const BASE_URL = 'https://hdcpmss-mobilefinal-j60e.onrender.com';

const ChatScreen = ({ navigation }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const flatListRef = useRef(null);
  const pollingInterval = useRef(null);

  useEffect(() => {
    initializeChat();
    
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  const initializeChat = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Session Expired', 'Please log in again.');
        navigation.replace('LoginScreen');
        return;
      }

      // Get user profile
      const resProfile = await axios.get(`${BASE_URL}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const userData = {
        userId: resProfile.data._id || resProfile.data.id,
        username: resProfile.data.username,
        email: resProfile.data.email,
      };
      setUserInfo(userData);

      // Fetch messages
      await fetchMessages(token, userData.userId);

      // Start polling for new messages every 3 seconds
      pollingInterval.current = setInterval(() => {
        fetchMessages(token, userData.userId, true);
      }, 3000);
    } catch (err) {
      console.error('❌ Error initializing chat:', err);
      Alert.alert('Error', 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (token, userId, silent = false) => {
    try {
      const response = await axios.get(`${BASE_URL}/api/messages/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const msgs = response.data || [];
      setMessages(msgs);

      // Count unread messages from admin
      const unread = msgs.filter(m => m.sender === 'admin' && !m.isRead).length;
      setUnreadCount(unread);

      // Mark messages as read
      if (unread > 0) {
        await markMessagesAsRead(token, userId);
      }

      // Scroll to bottom on initial load
      if (!silent && msgs.length > 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (err) {
      if (!silent) {
        console.error('❌ Error fetching messages:', err);
      }
    }
  };

  const markMessagesAsRead = async (token, userId) => {
    try {
      await axios.put(
        `${BASE_URL}/api/messages/${userId}/mark-read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('❌ Error marking messages as read:', err);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const token = await AsyncStorage.getItem('token');
      
      await axios.post(
        `${BASE_URL}/api/messages`,
        {
          userId: userInfo.userId,
          userEmail: userInfo.email,
          username: userInfo.username,
          message: messageText,
          sender: 'patient',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Refresh messages
      await fetchMessages(token, userInfo.userId);
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.error('❌ Error sending message:', err);
      Alert.alert('Error', 'Failed to send message');
      setNewMessage(messageText); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const renderMessage = ({ item, index }) => {
    const isPatient = item.sender === 'patient';
    const showDate = index === 0 || 
      new Date(messages[index - 1].createdAt).toDateString() !== new Date(item.createdAt).toDateString();

    return (
      <>
        {showDate && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateSeparatorLine} />
            <Text style={styles.dateSeparatorText}>
              {new Date(item.createdAt).toLocaleDateString('en-US', { 
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
            <View style={styles.dateSeparatorLine} />
          </View>
        )}
        <View style={[
          styles.messageContainer,
          isPatient ? styles.patientMessageContainer : styles.adminMessageContainer
        ]}>
          <View style={[
            styles.messageBubble,
            isPatient ? styles.patientBubble : styles.adminBubble
          ]}>
            {!isPatient && (
              <View style={styles.adminHeader}>
                <Text style={styles.adminLabel}>👨‍⚕️ Halili's Dental Clinic</Text>
              </View>
            )}
            <Text style={[
              styles.messageText,
              isPatient ? styles.patientText : styles.adminText
            ]}>
              {item.message}
            </Text>
            <View style={styles.messageFooter}>
              <Text style={[
                styles.messageTime,
                isPatient ? styles.patientTime : styles.adminTime
              ]}>
                {formatTime(item.createdAt)}
              </Text>
              {isPatient && (
                <Text style={styles.messageStatus}>
                  {item.isRead ? '✓✓' : '✓'}
                </Text>
              )}
            </View>
          </View>
        </View>
      </>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#048E04" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#048E04" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>Halili's Dental Clinic</Text>
              <Text style={styles.headerSubtitle}>Chat Support</Text>
            </View>
            <View style={styles.headerIcon}>
              <Text style={styles.headerIconText}>💬</Text>
            </View>
          </View>

          {/* Messages List */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Text style={styles.emptyStateIconText}>💬</Text>
                </View>
                <Text style={styles.emptyStateTitle}>Start a Conversation</Text>
                <Text style={styles.emptyStateDescription}>
                  Send a message to Halili's Dental Clinic. We're here to help with any questions about your appointments or dental care.
                </Text>
              </View>
            }
          />

          {/* Input Area */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Type your message..."
                placeholderTextColor="#9CA3AF"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                maxLength={500}
                editable={!sending}
              />
              <TouchableOpacity 
                onPress={sendMessage}
                style={[
                  styles.sendButton,
                  (!newMessage.trim() || sending) && styles.sendButtonDisabled
                ]}
                disabled={!newMessage.trim() || sending}
                activeOpacity={0.7}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>➤</Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.inputHelper}>
              {newMessage.length}/500 characters
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#048E04',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#048E04',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    borderBottomLeftRadius: wp(6),
    borderBottomRightRadius: wp(6),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  backButton: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
  },
  backButtonText: {
    fontSize: wp(6),
    color: '#fff',
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerIcon: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: {
    fontSize: wp(6),
  },

  // Messages
  messagesList: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    flexGrow: 1,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: hp(2),
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dateSeparatorText: {
    fontSize: fontSize.xs,
    color: '#9CA3AF',
    paddingHorizontal: wp(3),
    fontWeight: '500',
  },
  messageContainer: {
    marginBottom: hp(1.5),
    maxWidth: '80%',
  },
  patientMessageContainer: {
    alignSelf: 'flex-end',
  },
  adminMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: wp(4),
    padding: wp(3),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  patientBubble: {
    backgroundColor: '#048E04',
    borderBottomRightRadius: wp(1),
  },
  adminBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: wp(1),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  adminHeader: {
    marginBottom: hp(0.5),
    paddingBottom: hp(0.5),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  adminLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: '#048E04',
  },
  messageText: {
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  patientText: {
    color: '#fff',
  },
  adminText: {
    color: '#1F2937',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: hp(0.5),
  },
  messageTime: {
    fontSize: fontSize.xs,
    marginRight: wp(1),
  },
  patientTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  adminTime: {
    color: '#9CA3AF',
  },
  messageStatus: {
    fontSize: fontSize.xs,
    color: 'rgba(255, 255, 255, 0.8)',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp(8),
    paddingHorizontal: wp(8),
  },
  emptyStateIcon: {
    width: wp(24),
    height: wp(24),
    borderRadius: wp(12),
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  emptyStateIconText: {
    fontSize: wp(12),
  },
  emptyStateTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp(1),
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Input
  inputContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: wp(4),
    paddingTop: hp(1.5),
    paddingBottom: hp(2),
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F9FAFB',
    borderRadius: wp(6),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: '#1F2937',
    maxHeight: hp(12),
    paddingVertical: hp(0.5),
  },
  sendButton: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#048E04',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: wp(2),
    shadowColor: '#048E04',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
  },
  sendButtonText: {
    fontSize: wp(5),
    color: '#fff',
    fontWeight: '600',
  },
  inputHelper: {
    fontSize: fontSize.xs,
    color: '#9CA3AF',
    marginTop: hp(0.5),
    marginLeft: wp(2),
  },
});

export default ChatScreen;