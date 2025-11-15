import { Ionicons } from '@expo/vector-icons';
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
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const API_BASE_URL = 'https://hdcpmss-mobilefinal-j60e.onrender.com';

const CustomAlert = ({ visible, type, title, message, onConfirm, onCancel, showCancel = false }) => {
  const [scaleAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 150,
        friction: 8,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible, scaleAnim]);

  const getIconConfig = () => {
    switch (type) {
      case 'success':
        return { name: 'checkmark-circle', color: '#10B981', backgroundColor: '#ECFDF5' };
      case 'error':
        return { name: 'close-circle', color: '#EF4444', backgroundColor: '#FEF2F2' };
      case 'warning':
        return { name: 'warning', color: '#F59E0B', backgroundColor: '#FFFBEB' };
      case 'info':
        return { name: 'information-circle', color: '#3B82F6', backgroundColor: '#EFF6FF' };
      default:
        return { name: 'information-circle', color: '#6B7280', backgroundColor: '#F9FAFB' };
    }
  };

  const iconConfig = getIconConfig();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.alertContainer, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.alertIconContainer, { backgroundColor: iconConfig.backgroundColor }]}>
            <Ionicons name={iconConfig.name} size={48} color={iconConfig.color} />
          </View>
          
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          
          <View style={styles.alertButtonContainer}>
            {showCancel && (
              <TouchableOpacity style={styles.alertCancelButton} onPress={onCancel}>
                <Text style={styles.alertCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.alertConfirmButton, { backgroundColor: iconConfig.color }]} 
              onPress={onConfirm}
            >
              <Text style={styles.alertConfirmButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const RegisterScreen = () => {
  const navigation = useNavigation();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    contactNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
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
    const { username, email, contactNumber, password, confirmPassword } = formData;

    if (!username.trim()) newErrors.username = 'Username is required';
    else if (username.length < 3) newErrors.username = 'Username must be at least 3 characters';
    else if (!/^[a-zA-Z0-9_]+$/.test(username)) newErrors.username = 'Username can only contain letters, numbers, and underscores';

    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Please enter a valid email address';

    if (!contactNumber.trim()) newErrors.contactNumber = 'Mobile number is required';
    else if (contactNumber.length < 10) newErrors.contactNumber = 'Mobile number must be at least 10 digits';
    else if (contactNumber.length > 15) newErrors.contactNumber = 'Mobile number cannot exceed 15 digits';

    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) newErrors.password = 'Password must contain uppercase, lowercase, and number';

    if (!confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      showAlert({
        type: 'error',
        title: 'Validation Error',
        message: 'Please fix the errors in the form before proceeding.',
      });
      return;
    }

    setIsLoading(true);
    const { username, email, contactNumber, password } = formData;

    try {
      const checkResponse = await axios.post(
        `${API_BASE_URL}/api/users/check`,
        { username: username.trim(), email: email.trim().toLowerCase() },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (checkResponse.data.exists) {
        showAlert({
          type: 'warning',
          title: 'Account Already Registered',
          message: 'An account with this email or username already exists. Please sign in instead.',
          onConfirm: hideAlert,
        });
        setIsLoading(false);
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/users/register`,
        { username: username.trim(), email: email.trim().toLowerCase(), contactNumber: contactNumber.trim(), password },
        { timeout: 10000, headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data.userId) {
        showAlert({
          type: 'success',
          title: 'Registration Successful!',
          message: 'A verification email has been sent to your email address.',
          onConfirm: () => {
            hideAlert();
            navigation.navigate('Verify', {
              userId: response.data.userId,
              email: email.trim().toLowerCase(),
            });
          },
        });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      let errorMessage = 'Registration failed. Please try again.';
      let errorTitle = 'Registration Failed';

      if (error.response?.data?.message) errorMessage = error.response.data.message;
      else if (error.response?.status === 409) {
        errorMessage = 'An account with this username or email already exists.';
        errorTitle = 'Account Already Exists';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'The request took too long. Check your internet connection.';
        errorTitle = 'Connection Timeout';
      } else if (!error.response) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
        errorTitle = 'Network Error';
      }

      showAlert({ type: 'error', title: errorTitle, message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => navigation.navigate('Login');

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.container}>
            {/* Compact Header */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../assets/images/newlogohalili.png')} 
                  style={styles.logo} 
                  resizeMode="contain" 
                />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.clinicName}>Halili Dental Clinic</Text>
                <Text style={styles.tagline}>Sa Halili Ikaw Mapapangiti</Text>
              </View>
            </View>

            {/* Title */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Fill in your details to get started</Text>
            </View>

            {/* Compact Form */}
            <View style={styles.formContainer}>
              <InputField 
                label="Username" 
                value={formData.username} 
                onChangeText={v => handleInputChange('username', v)} 
                placeholder="Enter username" 
                error={errors.username} 
                autoCapitalize="none"
                leftIcon={<Ionicons name="person-outline" size={18} color="#666" />}
              />
              
              <InputField 
                label="Email" 
                value={formData.email} 
                onChangeText={v => handleInputChange('email', v)} 
                placeholder="Enter email" 
                keyboardType="email-address" 
                autoCapitalize="none" 
                error={errors.email}
                leftIcon={<Ionicons name="mail-outline" size={18} color="#666" />}
              />
              
              <InputField 
                label="Mobile Number" 
                value={formData.contactNumber} 
                onChangeText={v => handleInputChange('contactNumber', v.replace(/[^0-9]/g, ''))} 
                placeholder="Enter mobile number" 
                keyboardType="numeric" 
                error={errors.contactNumber}
                maxLength={15}
                leftIcon={<Ionicons name="call-outline" size={18} color="#666" />}
              />
              
              <InputField 
                label="Password" 
                value={formData.password} 
                onChangeText={v => handleInputChange('password', v)} 
                placeholder="Enter password" 
                secureTextEntry={!showPassword} 
                error={errors.password}
                leftIcon={<Ionicons name="lock-closed-outline" size={18} color="#666" />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#666" />
                  </TouchableOpacity>
                }
              />
              
              <InputField 
                label="Confirm Password" 
                value={formData.confirmPassword} 
                onChangeText={v => handleInputChange('confirmPassword', v)} 
                placeholder="Confirm password" 
                secureTextEntry={!showConfirmPassword} 
                error={errors.confirmPassword}
                leftIcon={<Ionicons name="lock-closed-outline" size={18} color="#666" />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#666" />
                  </TouchableOpacity>
                }
              />

              <TouchableOpacity
                style={[styles.registerButton, isLoading && styles.buttonDisabled]}
                onPress={handleRegister}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.registerButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>

              <View style={styles.loginSection}>
                <Text style={styles.loginPrompt}>Already have an account? </Text>
                <TouchableOpacity onPress={handleLogin} disabled={isLoading}>
                  <Text style={styles.loginButtonText}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomAlert 
        visible={alertConfig.visible} 
        type={alertConfig.type} 
        title={alertConfig.title} 
        message={alertConfig.message} 
        onConfirm={alertConfig.onConfirm} 
        onCancel={alertConfig.onCancel} 
        showCancel={alertConfig.showCancel} 
      />
    </SafeAreaView>
  );
};

const InputField = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType,
  autoCapitalize,
  error,
  leftIcon,
  rightIcon,
  maxLength,
}) => (
  <View style={styles.inputWrapper}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.inputContainer, error && styles.inputError]}>
      {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}
      <TextInput
        style={[styles.input, leftIcon && styles.inputWithLeftIcon]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
      />
      {rightIcon && <View style={styles.rightIconContainer}>{rightIcon}</View>}
    </View>
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 24,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
  },
  logoContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  logo: {
    width: 48,
    height: 48,
  },
  headerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  clinicName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    fontFamily: 'Nunito',
  },
  tagline: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Nunito',
    marginTop: 2,
  },
  titleContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1a1a1a',
    fontFamily: 'Nunito',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Nunito',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'Nunito',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderColor: '#e1e5e9',
    borderWidth: 1.5,
    backgroundColor: '#fafbfc',
    paddingHorizontal: 12,
    height: 48,
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  leftIconContainer: {
    marginRight: 10,
  },
  rightIconContainer: {
    marginLeft: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a1a',
    fontFamily: 'Nunito',
    paddingVertical: 0,
  },
  inputWithLeftIcon: {
    marginLeft: 0,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    fontFamily: 'Nunito',
    marginTop: 4,
    marginLeft: 4,
  },
  registerButton: {
    backgroundColor: '#048E04',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#048E04',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  loginSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginPrompt: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Nunito',
  },
  loginButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#048E04',
    fontFamily: 'Nunito',
  },
  // Alert Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  alertContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    minWidth: screenWidth * 0.8,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  alertIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Nunito',
  },
  alertMessage: {
    fontSize: 16,
    fontWeight: '400',
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    fontFamily: 'Nunito',
  },
  alertButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  alertConfirmButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  alertConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Nunito',
  },
  alertCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    minWidth: 100,
    alignItems: 'center',
  },
  alertCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    fontFamily: 'Nunito',
  },
});

export default RegisterScreen;