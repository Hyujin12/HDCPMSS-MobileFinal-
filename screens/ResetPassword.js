import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const BASE_URL = "https://hdcpmss-mobilefinal-j60e.onrender.com";

const ResetPassword = () => {
  const navigation = useNavigation();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // 🔁 Countdown timer for resend button
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  // ✅ Send verification code to email
  const handleSendCode = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your Gmail address.");
      return;
    }

    setSendingCode(true);
    try {
      const response = await axios.post(`${BASE_URL}/api/users/forgot-password`, { email });

      if (response.data.message) {
        Alert.alert("Success", "Verification code sent to your Gmail address.");
        setCooldown(30); // ⏳ disable button for 30 seconds
      } else {
        Alert.alert("Error", response.data.error || "Failed to send code.");
      }
    } catch (error) {
      console.error("Send code error:", error);
      Alert.alert("Error", "Unable to send verification code. Please try again.");
    } finally {
      setSendingCode(false);
    }
  };

  // ✅ Handle password reset
  const handleResetPassword = async () => {
    if (!email.trim() || !code.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert("Missing Field", "Please fill in all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    setLoading(true);
    setModalVisible(true);

    try {
      const response = await axios.post(`${BASE_URL}/api/users/reset-password`, {
        email,
        code,
        newPassword,
      });

      setLoading(false);
      setModalVisible(false);

      if (response.data.message === "Password reset successful") {
        Alert.alert("Success", "Your password has been reset successfully.");
        navigation.navigate("Login");
      } else {
        Alert.alert("Error", response.data.error || "Invalid code or expired.");
      }
    } catch (error) {
      console.error("Reset password error:", error);
      setLoading(false);
      setModalVisible(false);
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.header}>Reset Password</Text>
        </View>

        <Text style={styles.subHeader}>
          Enter your Gmail address, receive a verification code, and reset your password.
        </Text>

        {/* ✅ Email input */}
        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={22} color="#333" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Enter your Gmail address"
            placeholderTextColor="#888"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* ✅ Code input + Send Code button in one row */}
        <View style={styles.rowContainer}>
          <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
            <Ionicons name="key-outline" size={22} color="#333" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Enter verification code"
              placeholderTextColor="#888"
              keyboardType="numeric"
              value={code}
              onChangeText={setCode}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendCodeButton,
              (sendingCode || cooldown > 0) && { opacity: 0.7 },
            ]}
            onPress={handleSendCode}
            disabled={sendingCode || cooldown > 0}
          >
            <Text style={styles.sendCodeText}>
              {sendingCode
                ? "Sending..."
                : cooldown > 0
                ? `Wait ${cooldown}s`
                : "Send Code"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={22} color="#333" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="New Password"
            placeholderTextColor="#888"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-open-outline" size={22} color="#333" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Confirm New Password"
            placeholderTextColor="#888"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleResetPassword}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? "Resetting..." : "Reset Password"}
          </Text>
        </TouchableOpacity>

        {/* Modal loading */}
        <Modal transparent visible={modalVisible} animationType="fade">
          <View style={styles.modalContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  scrollContainer: { flexGrow: 1, padding: 20, justifyContent: "center" },
  headerContainer: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backButton: { marginRight: 10 },
  header: { fontSize: 26, fontWeight: "bold", color: "#333" },
  subHeader: { fontSize: 15, color: "#555", marginBottom: 30 },
  rowContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
    marginBottom: 20,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: "#333" },
  sendCodeButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sendCodeText: { color: "#FFF", fontWeight: "600", fontSize: 14 },
  submitButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  submitButtonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
});

export default ResetPassword;
