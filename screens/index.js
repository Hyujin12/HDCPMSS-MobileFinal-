import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Responsive sizing helper
const wp = (percentage) => (screenWidth * percentage) / 100;
const hp = (percentage) => (screenHeight * percentage) / 100;
const isSmallDevice = screenWidth < 375;
const isMediumDevice = screenWidth >= 375 && screenWidth < 414;

const API_BASE_URL = 'https://hdcpmss-mobile-1.onrender.com';

// --- Custom Alert Component ---
const CustomAlert = ({ visible, type, title, message, onConfirm, onCancel, showCancel = false }) => {
  const [scaleAnim] = useState(new Animated.Value(0));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { 
          toValue: 1, 
          useNativeDriver: true, 
          tension: 100, 
          friction: 10 
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible, scaleAnim, fadeAnim]);

  const getIconConfig = () => {
    switch (type) {
      case 'success': return { name: 'checkmark-circle', color: '#10B981', backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' };
      case 'error': return { name: 'close-circle', color: '#EF4444', backgroundColor: '#FEF2F2', borderColor: '#FECACA' };
      case 'warning': return { name: 'warning', color: '#F59E0B', backgroundColor: '#FFFBEB', borderColor: '#FDE68A' };
      case 'info': return { name: 'information-circle', color: '#3B82F6', backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' };
      default: return { name: 'information-circle', color: '#6B7280', backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' };
    }
  };

  const iconConfig = getIconConfig();

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.alertContainer, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.alertIconContainer, { 
            backgroundColor: iconConfig.backgroundColor,
            borderWidth: 2,
            borderColor: iconConfig.borderColor,
          }]}>
            <Ionicons name={iconConfig.name} size={wp(12)} color={iconConfig.color} />
          </View>
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          <View style={styles.alertButtonContainer}>
            {showCancel && (
              <TouchableOpacity 
                style={[styles.alertCancelButton, { flex: 1 }]} 
                onPress={onCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.alertCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.alertConfirmButton, 
                { backgroundColor: iconConfig.color, flex: 1 }
              ]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.alertConfirmButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// --- Login Screen ---
const LoginScreen = () => {
  const navigation = useNavigation();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
    showCancel: false,
  });

  const showAlert = (config) => {
    setAlertConfig({
      visible: true,
      type: config.type || 'info',
      title: config.title || 'Alert',
      message: config.message || '',
      onConfirm: config.onConfirm || (() => hideAlert()),
      onCancel: config.onCancel || (() => hideAlert()),
      showCancel: config.showCancel || false,
    });
  };

  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  }, [errors]);

  const validateForm = () => {
    const newErrors = {};
    const { email, password } = formData;
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Please enter a valid email';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      showAlert({ type: 'error', title: 'Validation Error', message: 'Please fix the errors in the form.' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/users/login`,
        { email: formData.email.trim().toLowerCase(), password: formData.password },
        { timeout: 10000, headers: { 'Content-Type': 'application/json' } }
      );

      const { token, user } = response.data;
      if (!token) throw new Error('No token received');

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('userId', user.id);
      await AsyncStorage.setItem('userEmail', user.email);

      showAlert({
        type: 'success',
        title: 'Login Successful!',
        message: 'Welcome back! Redirecting to your dashboard...',
        onConfirm: () => {
          hideAlert();
          navigation.replace('HomeScreen');
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      const serverMessage = error.response?.data?.error || error.response?.data?.message;
      if (serverMessage === 'Please verify your email first') {
        showAlert({
          type: 'warning',
          title: 'Email Verification Required',
          message: 'Your account needs to be verified. Go to verification page?',
          showCancel: true,
          onConfirm: () => {
            hideAlert();
            const userId = error.response?.data?.userId;
            navigation.navigate('Verify', { userId, email: formData.email.trim().toLowerCase(), fromLogin: true });
          },
          onCancel: () => hideAlert(),
        });
      } else if (serverMessage === 'Invalid email or password') {
        showAlert({ type: 'error', title: 'Login Failed', message: 'Incorrect email or password.' });
      } else if (error.response?.status === 404) {
        showAlert({ type: 'error', title: 'Account Not Found', message: 'No account found with this email.' });
      } else if (error.code === 'ECONNABORTED') {
        showAlert({ type: 'error', title: 'Timeout', message: 'Request timed out. Check your internet.' });
      } else {
        showAlert({ type: 'error', title: 'Network Error', message: 'Cannot connect to server.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = () => navigation.navigate('Register');
  const handleForgotPassword = () => showAlert({
    type: 'info',
    title: 'Forgot Password',
    message: 'Please contact the clinic to reset your password.',
  });

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Header Section */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <View style={styles.logoInnerCircle}>
                  <Image 
                    source={require('../assets/halili logo.png')} 
                    style={styles.logo} 
                    resizeMode="contain" 
                  />
                </View>
              </View>
              <Text style={styles.clinicName}>Halili's Dental Clinic</Text>
              <Text style={styles.tagline}>Sa Halili Ikaw Mapapangiti</Text>
            </View>

            {/* Form Section */}
            <View style={styles.formContainer}>
              <View style={styles.formHeader}>
                <Text style={styles.welcomeText}>Welcome Back</Text>
                <Text style={styles.subtitleText}>Sign in to continue to your account</Text>
              </View>

              <View style={styles.inputSection}>
                <InputField
                  label="Email Address"
                  value={formData.email}
                  onChangeText={value => handleInputChange('email', value)}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={errors.email}
                  icon="mail-outline"
                />

                <InputField
                  label="Password"
                  value={formData.password}
                  onChangeText={value => handleInputChange('password', value)}
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                  error={errors.password}
                  icon="lock-closed-outline"
                  rightIcon={
                    <TouchableOpacity 
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeIconButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons 
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                        size={wp(5.5)} 
                        color="#6B7280" 
                      />
                    </TouchableOpacity>
                  }
                />

                <TouchableOpacity 
                  onPress={handleForgotPassword} 
                  disabled={isLoading}
                  style={styles.forgotPasswordButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              <ActionButton
                title={isLoading ? 'Signing In...' : 'Sign In'}
                onPress={handleLogin}
                disabled={isLoading}
                loading={isLoading}
              />

              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.divider} />
              </View>

              <View style={styles.registerSection}>
                <Text style={styles.registerPrompt}>Don't have an account?</Text>
                <TouchableOpacity 
                  onPress={handleRegister} 
                  disabled={isLoading}
                  style={styles.registerButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.registerButtonText}>Create Account</Text>
                  <Ionicons name="arrow-forward" size={wp(4.5)} color="#048E04" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                By signing in, you agree to our Terms & Privacy Policy
              </Text>
            </View>
          </View>
        </ScrollView>

        <CustomAlert
          visible={alertConfig.visible}
          type={alertConfig.type}
          title={alertConfig.title}
          message={alertConfig.message}
          onConfirm={alertConfig.onConfirm}
          onCancel={alertConfig.onCancel}
          showCancel={alertConfig.showCancel}
        />
      </KeyboardAvoidingView>
    </>
  );
};

// --- Input Field Component ---
const InputField = ({ 
  label, 
  value, 
  onChangeText, 
  placeholder, 
  secureTextEntry = false, 
  style, 
  keyboardType, 
  autoCapitalize, 
  autoCorrect, 
  error, 
  rightIcon, 
  icon,
  maxLength 
}) => (
  <View style={[styles.inputWrapper, style]}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.inputContainer, error && styles.inputError]}>
      {icon && (
        <Ionicons name={icon} size={wp(5)} color="#9CA3AF" style={styles.leftIcon} />
      )}
      <TextInput
        style={[styles.input, icon && styles.inputWithLeftIcon, rightIcon && styles.inputWithRightIcon]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        maxLength={maxLength}
      />
      {rightIcon}
    </View>
    {error && (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={wp(3.5)} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )}
  </View>
);

// --- Action Button Component ---
const ActionButton = ({ 
  title, 
  onPress, 
  style, 
  textStyle, 
  variant = 'primary', 
  disabled = false, 
  loading = false 
}) => {
  const buttonStyle = [
    variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
    disabled && styles.buttonDisabled,
    style,
  ];
  const buttonTextStyle = [
    variant === 'primary' ? styles.primaryButtonText : styles.secondaryButtonText,
    disabled && styles.buttonTextDisabled,
    textStyle,
  ];

  return (
    <TouchableOpacity 
      style={buttonStyle} 
      onPress={onPress} 
      activeOpacity={disabled ? 1 : 0.8} 
      disabled={disabled}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text style={buttonTextStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

// --- Responsive Styles ---
const styles = StyleSheet.create({
  keyboardView: { 
    flex: 1, 
    backgroundColor: '#f8f9fa' 
  },
  scrollContainer: { 
    flexGrow: 1, 
    paddingBottom: hp(3) 
  },
  container: { 
    flex: 1,
    marginHorizontal: 'auto',
    maxWidth: 480, 
    width: '100%', 
    paddingTop: Platform.OS === 'ios' ? hp(8) : hp(6), 
    paddingHorizontal: wp(5), 
    alignItems: 'stretch' 
  },
  
  // Header
  header: { 
    alignItems: 'center', 
    marginBottom: hp(4) 
  },
  logoContainer: { 
    backgroundColor: '#fff', 
    borderRadius: wp(16), 
    padding: wp(3),
    shadowColor: '#048E04', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 12, 
    elevation: 8,
    marginBottom: hp(2),
  },
  logoInnerCircle: {
    backgroundColor: '#F0FDF4',
    borderRadius: wp(14),
    padding: wp(2),
  },
  logo: { 
    width: wp(18), 
    height: wp(18) 
  },
  clinicName: { 
    fontSize: isSmallDevice ? wp(6.5) : wp(7), 
    fontWeight: '800', 
    color: '#1F2937', 
    fontFamily: 'Nunito',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  tagline: { 
    fontSize: isSmallDevice ? wp(3.2) : wp(3.5), 
    fontWeight: '500', 
    marginTop: hp(0.5), 
    color: '#6B7280', 
    fontFamily: 'Nunito',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  
  // Form Container
  formContainer: { 
    backgroundColor: '#fff', 
    borderRadius: wp(5), 
    padding: wp(6),
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 16, 
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  formHeader: {
    marginBottom: hp(3),
  },
  welcomeText: { 
    fontSize: isSmallDevice ? wp(6) : wp(6.5), 
    fontWeight: '700', 
    color: '#1F2937', 
    textAlign: 'center',
    fontFamily: 'Nunito',
    letterSpacing: -0.3,
  },
  subtitleText: { 
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8), 
    fontWeight: '400', 
    color: '#6B7280', 
    textAlign: 'center',
    marginTop: hp(0.8),
    fontFamily: 'Nunito',
  },
  
  // Input Section
  inputSection: {
    marginBottom: hp(2),
  },
  inputWrapper: { 
    width: '100%', 
    marginBottom: hp(2.5) 
  },
  label: { 
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8), 
    fontWeight: '600', 
    color: '#374151', 
    fontFamily: 'Nunito', 
    marginBottom: hp(1) 
  },
  inputContainer: { 
    borderRadius: wp(3), 
    borderColor: '#E5E7EB', 
    borderWidth: 1.5, 
    paddingHorizontal: wp(4), 
    paddingVertical: Platform.OS === 'ios' ? hp(1.8) : hp(1.5), 
    backgroundColor: '#F9FAFB', 
    flexDirection: 'row', 
    alignItems: 'center',
    minHeight: hp(6.5),
  },
  inputError: { 
    borderColor: '#EF4444', 
    backgroundColor: '#FEF2F2' 
  },
  leftIcon: {
    marginRight: wp(3),
  },
  input: { 
    flex: 1, 
    fontSize: isSmallDevice ? wp(3.8) : wp(4), 
    fontWeight: '400', 
    color: '#1F2937', 
    fontFamily: 'Nunito', 
    paddingVertical: 0 
  },
  inputWithLeftIcon: { 
    paddingLeft: 0 
  },
  inputWithRightIcon: { 
    paddingRight: wp(2) 
  },
  eyeIconButton: {
    padding: wp(1),
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp(0.8),
    marginLeft: wp(1),
  },
  errorText: { 
    fontSize: isSmallDevice ? wp(3) : wp(3.2), 
    color: '#EF4444', 
    fontFamily: 'Nunito',
    marginLeft: wp(1),
  },
  
  // Forgot Password
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: hp(1),
  },
  forgotPasswordText: { 
    fontSize: isSmallDevice ? wp(3.3) : wp(3.5), 
    fontWeight: '600', 
    color: '#048E04', 
    fontFamily: 'Nunito',
  },
  
  // Buttons
  primaryButton: { 
    backgroundColor: '#048E04', 
    borderRadius: wp(3), 
    paddingVertical: hp(2), 
    paddingHorizontal: wp(6), 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: hp(2.5),
    shadowColor: '#048E04', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 6,
    minHeight: hp(6.5),
  },
  primaryButtonText: { 
    fontSize: isSmallDevice ? wp(4) : wp(4.2), 
    fontWeight: '700', 
    color: '#fff', 
    fontFamily: 'Nunito',
    letterSpacing: 0.5,
  },
  buttonDisabled: { 
    backgroundColor: '#D1D5DB', 
    shadowOpacity: 0, 
    elevation: 0 
  },
  buttonTextDisabled: { 
    color: '#9CA3AF' 
  },
  
  // Divider
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: hp(3),
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: isSmallDevice ? wp(3) : wp(3.2),
    fontWeight: '600',
    color: '#9CA3AF',
    fontFamily: 'Nunito',
    marginHorizontal: wp(4),
  },
  
  // Register Section
  registerSection: { 
    alignItems: 'center',
  },
  registerPrompt: { 
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8), 
    fontWeight: '400', 
    color: '#6B7280', 
    fontFamily: 'Nunito',
    marginBottom: hp(1.2),
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  registerButtonText: { 
    fontSize: isSmallDevice ? wp(4) : wp(4.2), 
    fontWeight: '700', 
    color: '#048E04', 
    fontFamily: 'Nunito',
  },
  
  // Footer
  footer: {
    marginTop: hp(4),
    paddingHorizontal: wp(4),
  },
  footerText: {
    fontSize: isSmallDevice ? wp(2.8) : wp(3),
    fontWeight: '400',
    color: '#9CA3AF',
    fontFamily: 'Nunito',
    textAlign: 'center',
    lineHeight: wp(4.5),
  },
  
  // Modal & Alert
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.6)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: wp(5) 
  },
  alertContainer: { 
    backgroundColor: '#fff', 
    borderRadius: wp(5), 
    paddingVertical: hp(4), 
    paddingHorizontal: wp(6), 
    alignItems: 'center', 
    width: '100%',
    maxWidth: wp(85),
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 20, 
    elevation: 10 
  },
  alertIconContainer: { 
    width: wp(20), 
    height: wp(20), 
    borderRadius: wp(10), 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: hp(2.5) 
  },
  alertTitle: { 
    fontSize: isSmallDevice ? wp(5) : wp(5.5), 
    fontWeight: '700', 
    color: '#1F2937', 
    textAlign: 'center', 
    marginBottom: hp(1.5), 
    fontFamily: 'Nunito' 
  },
  alertMessage: { 
    fontSize: isSmallDevice ? wp(3.8) : wp(4), 
    fontWeight: '400', 
    color: '#6B7280', 
    textAlign: 'center', 
    lineHeight: wp(6), 
    marginBottom: hp(3), 
    fontFamily: 'Nunito' 
  },
  alertButtonContainer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: wp(3), 
    width: '100%' 
  },
  alertConfirmButton: { 
    paddingVertical: hp(1.5), 
    paddingHorizontal: wp(6), 
    borderRadius: wp(3), 
    alignItems: 'center',
    minHeight: hp(5.5),
    justifyContent: 'center',
  },
  alertConfirmButtonText: { 
    fontSize: isSmallDevice ? wp(3.8) : wp(4), 
    fontWeight: '700', 
    color: '#fff', 
    fontFamily: 'Nunito' 
  },
  alertCancelButton: { 
    paddingVertical: hp(1.5), 
    paddingHorizontal: wp(6), 
    borderRadius: wp(3), 
    backgroundColor: '#F3F4F6', 
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    minHeight: hp(5.5),
    justifyContent: 'center',
  },
  alertCancelButtonText: { 
    fontSize: isSmallDevice ? wp(3.8) : wp(4), 
    fontWeight: '700', 
    color: '#6B7280', 
    fontFamily: 'Nunito' 
  },
});

export default LoginScreen;