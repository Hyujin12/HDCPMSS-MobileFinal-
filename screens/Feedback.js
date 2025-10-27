import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
const BASE_URL = 'https://hdcpmss-mobilefinal.onrender.com/api';
 // update with your backend IP/port

const FeedbackScreen = () => {
  const [completedAppointments, setCompletedAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [rating, setRating] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    fetchCompletedAppointments();
  }, []);

  const fetchCompletedAppointments = async () => {
    try {
      setLoading(true);
      const user = await AsyncStorage.getItem("user");
      const parsedUser = JSON.parse(user);
      const response = await axios.get(`${BASE_URL}/feedback/${parsedUser._id}`);
      setCompletedAppointments(response.data);
    } catch (error) {
      Alert.alert("Error", "Unable to fetch completed appointments.");
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!rating || !feedback.trim()) {
      Alert.alert("⚠️ Please fill out both fields before submitting.");
      return;
    }

    try {
      await axios.post(`${BASE_URL}/feedback/${selectedBooking._id}`, {
        rating,
        feedback,
      });
      Alert.alert("✅ Feedback submitted successfully!");
      setModalVisible(false);
      setRating("");
      setFeedback("");
      fetchCompletedAppointments();
    } catch (error) {
      Alert.alert("Error", "Failed to submit feedback.");
      console.log(error);
    }
  };

  const renderAppointment = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.serviceName}>{item.serviceName}</Text>
      <Text style={styles.date}>
        {new Date(item.appointmentDate).toLocaleDateString()}
      </Text>
      <TouchableOpacity
        style={styles.feedbackButton}
        onPress={() => {
          setSelectedBooking(item);
          setModalVisible(true);
        }}
      >
        <Text style={styles.feedbackButtonText}>
          {item.feedback ? "Edit Feedback" : "Give Feedback"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🦷 Completed Appointments</Text>
      {completedAppointments.length === 0 ? (
        <Text style={styles.noData}>No completed services yet.</Text>
      ) : (
        <FlatList
          data={completedAppointments}
          keyExtractor={(item) => item._id}
          renderItem={renderAppointment}
        />
      )}

      {/* Feedback Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Give Feedback</Text>

            <TextInput
              style={styles.input}
              placeholder="Rating (1–5)"
              keyboardType="numeric"
              maxLength={1}
              value={rating}
              onChangeText={setRating}
            />
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Write your feedback..."
              multiline
              value={feedback}
              onChangeText={setFeedback}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSubmitFeedback}
              >
                <Text style={styles.saveText}>Submit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default FeedbackScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f2f2", padding: 16 },
  header: { fontSize: 22, fontWeight: "bold", marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    elevation: 2,
  },
  serviceName: { fontSize: 16, fontWeight: "600" },
  date: { fontSize: 14, color: "gray", marginVertical: 6 },
  feedbackButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  feedbackButtonText: { color: "#fff", fontWeight: "bold" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  noData: { textAlign: "center", color: "gray", marginTop: 20 },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  modalButtons: { flexDirection: "row", justifyContent: "space-between" },
  saveButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 10,
    flex: 1,
    marginRight: 5,
  },
  cancelButton: {
    backgroundColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    flex: 1,
    marginLeft: 5,
  },
  saveText: { color: "#fff", textAlign: "center", fontWeight: "bold" },
  cancelText: { textAlign: "center", fontWeight: "bold" },
});
