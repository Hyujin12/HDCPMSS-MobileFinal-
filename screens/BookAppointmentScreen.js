import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import axios from "axios";
import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const wp = (percentage) => (screenWidth * percentage) / 100;
const hp = (percentage) => (screenHeight * percentage) / 100;
const isSmallDevice = screenWidth < 375;

const BASE_URL = "https://hdcpmss-mobile-1.onrender.com";

const services = [
  { 
    title: "Dental Checkup", 
    image: require("../assets/images/dental check up.jpg"), 
    description: "Routine examination to identify potential dental issues early",
    icon: "🦷",
    color: "#EFF6FF"
  },
  { 
    title: "Dental Extraction", 
    image: require("../assets/images/dental extraction.jpg"), 
    description: "Surgical procedure to safely remove problematic teeth",
    icon: "🔧",
    color: "#FEF3C7"
  },
  { 
    title: "Dental Restoration", 
    image: require("../assets/images/dental restoration.jpg"), 
    description: "Restore tooth's original shape, function, and appearance",
    icon: "⚡",
    color: "#ECFDF5"
  },
  { 
    title: "Dental Surgery", 
    image: require("../assets/images/dental surgery.jpg"), 
    description: "Advanced procedures including extractions and corrections",
    icon: "🏥",
    color: "#FEE2E2"
  },
  { 
    title: "Oral Prophylaxis", 
    image: require("../assets/images/oral prophylaxis.jpg"), 
    description: "Professional cleaning to remove plaque and tartar",
    icon: "✨",
    color: "#E0E7FF"
  },
  { 
    title: "Orthodontics", 
    image: require("../assets/images/orthodontics.jpg"), 
    description: "Braces and aligners to straighten teeth and fix bites",
    icon: "🦷",
    color: "#FCE7F3"
  },
  { 
    title: "Prosthodontics", 
    image: require("../assets/images/prosthodontics.jpg"), 
    description: "Replace missing teeth with crowns, bridges, or implants",
    icon: "👄",
    color: "#FEF3C7"
  },
];

const ServicesScreen = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [description, setDescription] = useState("");
  const [user, setUser] = useState({ id: "", username: "", email: "" });
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const res = await axios.get(`${BASE_URL}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUser({ id: res.data._id, username: res.data.username, email: res.data.email });
      setUsername(res.data.username);
      setEmail(res.data.email);
      setPhoneNumber(res.data.contactNumber || "");
      setContactNumber(res.data.contactNumber || "");
    } catch (err) {
      console.error("Failed to fetch user:", err.message);
      Alert.alert("Error", "Failed to fetch user profile. Make sure you are logged in.");
    }
  };

  const openModal = (service) => {
    setSelectedService(service);
    setModalVisible(true);
  };

  const submitBooking = async () => {
    if (!contactNumber) {
      Alert.alert("Error", "Please fill the phone number.");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "You must be logged in to book a service.");
        return;
      }

      const bookingData = {
        userId: user.id,
        serviceName: selectedService.title,
        fullname: username,
        email,
        phone: contactNumber,
        description,
        date: date.toISOString().split("T")[0],
        time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      await axios.post(`${BASE_URL}/api/booked-services`, bookingData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert("Success", "Your service has been booked!");
      setModalVisible(false);
      setContactNumber(phoneNumber);
      setDescription("");
      setDate(new Date());
    } catch (err) {
      console.error("Booking Error:", err.response?.data || err.message);
      Alert.alert("Error", "Failed to book service.");
    }
  };

  const onChangeDate = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === "ios");
    
    // Only set date if it's today or in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (currentDate >= today) {
      setDate(currentDate);
    } else {
      Alert.alert("Invalid Date", "Please select today or a future date.");
    }
  };

  const onChangeTime = (event, selectedTime) => {
    const currentTime = selectedTime || date;
    setShowTimePicker(Platform.OS === "ios");
    
    // Check if selected date is today
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // If booking for today, check if time is in the future
    if (selectedDate.getTime() === today.getTime()) {
      const now = new Date();
      if (currentTime < now) {
        Alert.alert("Invalid Time", "Please select a time in the future.");
        return;
      }
    }
    
    setDate(currentTime);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.serviceCard}
      onPress={() => openModal(item)}
      activeOpacity={0.7}
    >
      <Image source={item.image} style={styles.serviceImage} />
      <View style={styles.serviceOverlay}>
        <View style={[styles.iconBadge, { backgroundColor: item.color }]}>
          <Text style={styles.iconBadgeText}>{item.icon}</Text>
        </View>
      </View>
      <View style={styles.serviceContent}>
        <Text style={styles.serviceTitle}>{item.title}</Text>
        <Text style={styles.serviceDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.bookBadge}>
          <Text style={styles.bookBadgeText}>Book Now →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#048E04" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Our Services</Text>
            <Text style={styles.headerSubtitle}>Choose the care you need</Text>
          </View>
        </View>

        {/* Services Grid */}
        <FlatList
          data={services}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
          numColumns={2}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
        />

        {/* Booking Modal */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Book Appointment</Text>
                  <Text style={styles.modalSubtitle}>{selectedService?.title}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.closeButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScroll}
              >
                {/* Form Fields */}
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Patient Information</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput
                      style={[styles.input, styles.disabledInput]}
                      value={username}
                      editable={false}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <TextInput
                      style={[styles.input, styles.disabledInput]}
                      value={email}
                      editable={false}
                      keyboardType="email-address"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Phone Number *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your phone number"
                      value={contactNumber}
                      onChangeText={setContactNumber}
                      keyboardType="phone-pad"
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Appointment Schedule</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Select Date</Text>
                    <TouchableOpacity
                      style={styles.dateTimeButton}
                      onPress={() => setShowDatePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dateTimeIcon}>📅</Text>
                      <Text style={styles.dateTimeText}>
                        {date.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {showDatePicker && (
                    <DateTimePicker
                      value={date}
                      mode="date"
                      display="calendar"
                      onChange={onChangeDate}
                      minimumDate={new Date()}
                    />
                  )}

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Select Time</Text>
                    <TouchableOpacity
                      style={styles.dateTimeButton}
                      onPress={() => setShowTimePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dateTimeIcon}>⏰</Text>
                      <Text style={styles.dateTimeText}>
                        {date.toLocaleTimeString([], { 
                          hour: "2-digit", 
                          minute: "2-digit" 
                        })}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {showTimePicker && (
                    <DateTimePicker
                      value={date}
                      mode="time"
                      is24Hour={false}
                      display="clock"
                      onChange={onChangeTime}
                    />
                  )}
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Additional Information</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Notes (Optional)</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Any special requests or concerns..."
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={submitBooking}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.submitButtonText}>Confirm Booking</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setModalVisible(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
};

export default ServicesScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#048E04",
  },
  header: {
    backgroundColor: "#048E04",
    paddingHorizontal: wp(5),
    paddingTop: hp(2),
    paddingBottom: hp(3),
  },
  headerTitle: {
    fontSize: isSmallDevice ? wp(6.5) : wp(7),
    fontWeight: "800",
    color: "#fff",
    marginBottom: hp(0.5),
  },
  headerSubtitle: {
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "500",
  },
  gridContainer: {
    backgroundColor: "#F5F5F5",
    borderTopLeftRadius: wp(6),
    borderTopRightRadius: wp(6),
    marginTop: -hp(2),
    paddingTop: hp(3),
    paddingHorizontal: wp(4),
    paddingBottom: hp(2),
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: hp(2),
  },
  serviceCard: {
    width: (screenWidth - wp(12)) / 2,
    backgroundColor: "#fff",
    borderRadius: wp(4),
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  serviceImage: {
    width: "100%",
    height: hp(15),
    resizeMode: "cover",
  },
  serviceOverlay: {
    position: "absolute",
    top: wp(2),
    right: wp(2),
  },
  iconBadge: {
    width: wp(9),
    height: wp(9),
    borderRadius: wp(4.5),
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  iconBadgeText: {
    fontSize: wp(5),
  },
  serviceContent: {
    padding: wp(3),
  },
  serviceTitle: {
    fontSize: isSmallDevice ? wp(3.8) : wp(4),
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: hp(0.5),
  },
  serviceDescription: {
    fontSize: isSmallDevice ? wp(3) : wp(3.2),
    color: "#666",
    lineHeight: wp(4.5),
    marginBottom: hp(1),
  },
  bookBadge: {
    backgroundColor: "#048E04",
    paddingVertical: hp(0.8),
    paddingHorizontal: wp(3),
    borderRadius: wp(2),
    alignSelf: "flex-start",
  },
  bookBadgeText: {
    color: "#fff",
    fontSize: isSmallDevice ? wp(3) : wp(3.2),
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: wp(6),
    borderTopRightRadius: wp(6),
    maxHeight: hp(90),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: wp(5),
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  modalTitle: {
    fontSize: isSmallDevice ? wp(5.5) : wp(6),
    fontWeight: "700",
    color: "#1a1a1a",
  },
  modalSubtitle: {
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    color: "#048E04",
    fontWeight: "600",
    marginTop: hp(0.3),
  },
  closeButton: {
    width: wp(9),
    height: wp(9),
    borderRadius: wp(4.5),
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: wp(5),
    color: "#666",
    fontWeight: "600",
  },
  modalScroll: {
    paddingBottom: hp(3),
  },
  formSection: {
    paddingHorizontal: wp(5),
    marginTop: hp(2),
  },
  sectionTitle: {
    fontSize: isSmallDevice ? wp(4) : wp(4.3),
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: hp(1.5),
  },
  inputGroup: {
    marginBottom: hp(2),
  },
  inputLabel: {
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    fontWeight: "600",
    color: "#333",
    marginBottom: hp(0.8),
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: wp(3),
    padding: wp(3.5),
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    color: "#1a1a1a",
    backgroundColor: "#fff",
  },
  disabledInput: {
    backgroundColor: "#F9F9F9",
    color: "#999",
  },
  textArea: {
    minHeight: hp(12),
    textAlignVertical: "top",
  },
  dateTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: wp(3),
    padding: wp(3.5),
    backgroundColor: "#F9F9F9",
  },
  dateTimeIcon: {
    fontSize: wp(5),
    marginRight: wp(3),
  },
  dateTimeText: {
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  buttonContainer: {
    paddingHorizontal: wp(5),
    marginTop: hp(2),
  },
  submitButton: {
    backgroundColor: "#048E04",
    paddingVertical: hp(2),
    borderRadius: wp(3),
    alignItems: "center",
    marginBottom: hp(1.5),
    elevation: 3,
    shadowColor: "#048E04",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: isSmallDevice ? wp(4) : wp(4.2),
    fontWeight: "700",
  },
  cancelButton: {
    backgroundColor: "#fff",
    paddingVertical: hp(2),
    borderRadius: wp(3),
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#DDD",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: isSmallDevice ? wp(4) : wp(4.2),
    fontWeight: "600",
  },
});