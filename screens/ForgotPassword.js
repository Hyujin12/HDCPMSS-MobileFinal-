import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { useState } from "react";
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

const ForgotPassword = () => {
  const navigation = useNavigation();
  const [stage, setStage] = useState("email"); // "email" or "reset"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Step 1: Send verification code
  const handleSendCode = async () => {
    if (!email.trim()) {
      Alert.alert("Missing Field", "Please enter your registered email.");
      return;
    }

    setLoading(true);
    setModalVisible(true);

    try {
      const response = await axios.post(`${BASE_URL}/api/users/forgot-password`, { email });
      setLoading(false);
      setModalVisible(false);

      if (response.data.message) {
        Alert.alert("Verification Sent", "Enter the code sent to your email.");
        setStage("reset");
      } else {
        Alert.alert("Error", response.data.message || "Something went wrong.");
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      setLoading(false);
      setModalVisible(false);
      Alert.alert("Error", "Unable to send reset code. Please try again.");
    }
  };

  // Step 2: Reset password using code
  const handleResetPassword = async () => {
    if (!code.trim() || !newPassword.trim() || !confirmPassword.trim()) {
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
          <Text style={styles.header}>
            {stage === "email" ? "Forgot Password" : "Reset Password"}
          </Text>
        </View>

        <Text style={styles.subHeader}>
          {stage === "email"
            ? "Enter your registered email to receive a verification code."
            : "Enter the code sent to your email and create a new password."}
        </Text>

        {/* EMAIL STAGE */}
        {stage === "email" && (
          <>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={22} color="#333" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#888"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSendCode}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? "Sending..." : "Send Verification Code"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* RESET STAGE */}
        {stage === "reset" && (
          <>
            <View style={styles.inputContainer}>
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

            <TouchableOpacity onPress={() => setStage("email")} style={{ marginTop: 15 }}>
              <Text style={{ color: "#007AFF", textAlign: "center" }}>Resend Code</Text>
            </TouchableOpacity>
          </>
        )}

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
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 25,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: "#333" },
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

export default ForgotPassword;
