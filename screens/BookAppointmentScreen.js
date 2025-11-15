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
const isMediumDevice = screenWidth >= 375 && screenWidth < 768;
const isLargeDevice = screenWidth >= 768;

const BASE_URL = "https://hdcpmss-mobilefinal-j60e.onrender.com";

// Dentist working hours configuration
const DENTIST_HOURS = {
  0: { start: 8, end: 12 },   // Sunday 8 AM - 12 PM
  1: { start: 8, end: 19 },   // Monday 8 AM - 7 PM
  2: { start: 8, end: 19 },   // Tuesday 8 AM - 7 PM
  3: { start: 8, end: 19 },   // Wednesday 8 AM - 7 PM
  4: { start: 8, end: 19 },   // Thursday 8 AM - 7 PM
  5: { start: 8, end: 17 },   // Friday 8 AM - 5 PM
  6: { start: 8, end: 19 },   // Saturday 8 AM - 7 PM
};

const services = [
  {
    title: "Dental Checkup",
    image: require("../assets/images/dental check up.jpg"),
    description: "A dental checkup is a routine examination that helps identify any potential dental issues early on. It typically includes a thorough cleaning, examination, and sometimes X-rays to ensure your teeth and gums are healthy.",
    icon: "🦷",
    color: "#DBEAFE",
  },
  {
    title: "Dental Extraction",
    image: require("../assets/images/dental extraction.jpg"),
    description: "Dental extraction is a surgical procedure to remove a tooth from the mouth. Dentists perform dental extractions for a variety of reasons, such as tooth decay, gum disease, or overcrowding.",
    icon: "🔧",
    color: "#FEF3C7",
  },
  {
    title: "Dental Restoration",
    image: require("../assets/images/dental restoration.jpg"),
    description: "Dental restoration is a process of restoring a tooth to its original shape, function, and appearance using composite resin, porcelain, or gold.",
    icon: "⚡",
    color: "#D1FAE5",
  },
  {
    title: "Dental Surgery",
    image: require("../assets/images/dental surgery.jpg"),
    description: "Dental surgery involves procedures like extractions, gum surgeries, and jaw corrections. These surgeries are performed by oral surgeons.",
    icon: "🏥",
    color: "#FEE2E2",
  },
  {
    title: "Oral Prophylaxis",
    image: require("../assets/images/oral prophylaxis.jpg"),
    description: "Oral prophylaxis is a preventive dental cleaning to remove plaque, tartar, and stains. Recommended every 6 months.",
    icon: "✨",
    color: "#E0E7FF",
  },
  {
    title: "Orthodontics",
    image: require("../assets/images/orthodontics.jpg"),
    description: "Orthodontics involves braces or aligners to straighten teeth and fix bite issues, improving function and aesthetics.",
    icon: "🦷",
    color: "#FCE7F3",
  },
  {
    title: "Prosthodontics",
    image: require("../assets/images/prosthodontics.jpg"),
    description: "Prosthodontics focuses on replacing missing teeth with crowns, bridges, dentures, or implants.",
    icon: "👄",
    color: "#FEF3C7",
  },
];

const ServicesScreen = ({ navigation }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [description, setDescription] = useState("");
  const [user, setUser] = useState({ id: "", username: "", email: "" });
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
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

  const getDentistHours = (selectedDate) => {
    const dayOfWeek = selectedDate.getDay();
    return DENTIST_HOURS[dayOfWeek];
  };

  const isTimeWithinClinicHours = (selectedDate, selectedTime) => {
    const dayOfWeek = selectedDate.getDay();
    const hours = DENTIST_HOURS[dayOfWeek];
    
    const selectedHour = selectedTime.getHours();
    const selectedMinute = selectedTime.getMinutes();
    const selectedTimeInMinutes = selectedHour * 60 + selectedMinute;
    const startTimeInMinutes = hours.start * 60;
    const endTimeInMinutes = hours.end * 60;

    return selectedTimeInMinutes >= startTimeInMinutes && selectedTimeInMinutes < endTimeInMinutes;
  };

  const getAvailableDaysMessage = () => {
    return "Open: Mon-Thu 8AM-7PM • Fri 8AM-5PM • Sat 8AM-7PM • Sun 8AM-12PM";
  };

  const checkExistingAppointment = async (selectedDate) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return false;

      const dateStr = selectedDate.toISOString().split("T")[0];
      
      const response = await axios.get(`${BASE_URL}/api/booked-services`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Check if user has any pending appointment on the selected date
      const existingAppointment = response.data.find(booking => 
        booking.userId === user.id && 
        booking.date === dateStr && 
        booking.status === "pending"
      );

      return existingAppointment;
    } catch (err) {
      console.error("Error checking appointments:", err.message);
      return false;
    }
  };

  const openModal = (service) => {
    setSelectedService(service);
    setModalVisible(true);
    setDate(new Date());
    setTime(new Date());
  };

  const submitBooking = async () => {
    if (!contactNumber) {
      Alert.alert("Missing Information", "Please provide your phone number.");
      return;
    }

    if (!date || !time) {
      Alert.alert("Missing Information", "Please select both date and time for your appointment.");
      return;
    }

    // Validate the selected time is within clinic hours
    if (!isTimeWithinClinicHours(date, time)) {
      const hours = getDentistHours(date);
      Alert.alert(
        "Invalid Time", 
        `Please select a time between ${hours.start}:00 and ${hours.end}:00 for the selected day.`
      );
      return;
    }

    // Check for existing pending appointment on the same day
    const existingAppointment = await checkExistingAppointment(date);
    if (existingAppointment) {
      Alert.alert(
        "Appointment Already Exists",
        `You already have a pending appointment on ${date.toLocaleDateString()} for ${existingAppointment.serviceName}.\n\nPlease choose a different date or cancel your existing appointment first.`,
        [{ text: "OK", style: "default" }]
      );
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Authentication Required", "You must be logged in to book a service.");
        return;
      }

      const formattedTime = time.toLocaleTimeString([], { 
        hour: "2-digit", 
        minute: "2-digit",
        hour12: true 
      });

      const bookingData = {
        userId: user.id,
        serviceName: selectedService.title,
        username,
        email,
        phone: contactNumber,
        description,
        date: date.toISOString().split("T")[0],
        time: formattedTime,
      };

      await axios.post(`${BASE_URL}/api/booked-services`, bookingData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert(
        "Booking Confirmed! ✓", 
        `Your ${selectedService.title} appointment has been scheduled for ${date.toLocaleDateString()} at ${formattedTime}.\n\nWe'll send you a confirmation email shortly.`,
        [{ text: "OK", style: "default" }]
      );
      
      setModalVisible(false);
      setContactNumber(phoneNumber);
      setDescription("");
      setDate(new Date());
      setTime(new Date());

      if (navigation) {
        navigation.navigate('HomeScreen', { refresh: Date.now() });
      }
    } catch (err) {
      console.error("Booking Error:", err.response?.data || err.message);
      Alert.alert("Booking Failed", "Unable to process your booking. Please try again or contact us directly.");
    }
  };

  const onChangeDate = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === "ios");
    
    if (!selectedDate) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      Alert.alert("Invalid Date", "Please select today or a future date.");
      return;
    }
    
    setDate(selectedDate);
  };

  const onChangeTime = (event, selectedTime) => {
    setShowTimePicker(Platform.OS === "ios");
    
    if (!selectedTime) return;
    
    setTime(selectedTime);
  };

  const getNumColumns = () => {
    if (isLargeDevice) return 1;
    return 2;
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.serviceCard,
        isLargeDevice && styles.serviceCardLarge
      ]}
      onPress={() => openModal(item)}
      activeOpacity={0.7}
    >
      {isLargeDevice ? (
        // Large device layout (horizontal card)
        <>
          <Image source={item.image} style={styles.serviceImageLarge} />
          <View style={styles.serviceContentLarge}>
            <View style={styles.serviceHeaderLarge}>
              <View style={[styles.iconBadgeLarge, { backgroundColor: item.color }]}>
                <Text style={styles.iconBadgeTextLarge}>{item.icon}</Text>
              </View>
              <View style={styles.serviceTitleContainer}>
                <Text style={styles.serviceTitleLarge}>{item.title}</Text>
                <Text style={styles.serviceDescriptionLarge}>
                  {item.description}
                </Text>
              </View>
            </View>
            <View style={styles.bookBadgeLarge}>
              <Text style={styles.bookBadgeTextLarge}>Book Now →</Text>
            </View>
          </View>
        </>
      ) : (
        // Small/Medium device layout (vertical card)
        <>
          <Image source={item.image} style={styles.serviceImage} />
          <View style={styles.serviceOverlay}>
            <View style={[styles.iconBadge, { backgroundColor: item.color }]}>
              <Text style={styles.iconBadgeText}>{item.icon}</Text>
            </View>
          </View>
          <View style={styles.serviceContent}>
            <Text style={styles.serviceTitle}>{item.title}</Text>
            <Text style={styles.serviceDescription} numberOfLines={3}>
              {item.description}
            </Text>
            <View style={styles.bookBadge}>
              <Text style={styles.bookBadgeText}>Book Now →</Text>
            </View>
          </View>
        </>
      )}
    </TouchableOpacity>
  );

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#047857" />
      <SafeAreaView style={styles.safeArea}>
        {/* Enhanced Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Dental Services</Text>
            <Text style={styles.headerSubtitle}>Professional care for your smile</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{services.length}</Text>
          </View>
        </View>

        {/* Clinic Hours Banner */}
        <View style={styles.clinicHoursBanner}>
          <Text style={styles.clinicHoursIcon}>🕐</Text>
          <View style={styles.clinicHoursContent}>
            <Text style={styles.clinicHoursTitle}>Clinic Hours</Text>
            <Text style={styles.clinicHoursText}>{getAvailableDaysMessage()}</Text>
          </View>
        </View>

        <FlatList
          data={services}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
          numColumns={getNumColumns()}
          key={getNumColumns()}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={!isLargeDevice ? styles.gridRow : null}
          showsVerticalScrollIndicator={false}
        />

        {/* Enhanced Modal */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={[
              styles.modalContainer,
              isLargeDevice && styles.modalContainerLarge
            ]}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderContent}>
                  <View style={[styles.modalIconBadge, { backgroundColor: selectedService?.color }]}>
                    <Text style={styles.modalIconText}>{selectedService?.icon}</Text>
                  </View>
                  <View style={styles.modalHeaderText}>
                    <Text style={styles.modalTitle}>{selectedService?.title}</Text>
                    <Text style={styles.modalSubtitle}>Complete your booking details</Text>
                  </View>
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
                {/* Service Description */}
                <View style={styles.serviceDescriptionCard}>
                  <Text style={styles.serviceDescriptionTitle}>About This Service</Text>
                  <Text style={styles.serviceDescriptionFull}>
                    {selectedService?.description}
                  </Text>
                </View>

                {/* Patient Information */}
                <View style={styles.formSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionIcon}>👤</Text>
                    <Text style={styles.sectionTitle}>Patient Information</Text>
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <View style={[styles.input, styles.disabledInput]}>
                      <Text style={styles.disabledInputText}>{username}</Text>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <View style={[styles.input, styles.disabledInput]}>
                      <Text style={styles.disabledInputText}>{email}</Text>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Phone Number <Text style={styles.required}>*</Text></Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., +63 912 345 6789"
                      value={contactNumber}
                      onChangeText={setContactNumber}
                      keyboardType="phone-pad"
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>

                {/* Appointment Schedule */}
                <View style={styles.formSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionIcon}>📅</Text>
                    <Text style={styles.sectionTitle}>Select Date & Time</Text>
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Appointment Date <Text style={styles.required}>*</Text></Text>
                    <TouchableOpacity
                      style={styles.dateTimeButton}
                      onPress={() => setShowDatePicker(true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dateTimeContent}>
                        <Text style={styles.dateTimeIcon}>📅</Text>
                        <View style={styles.dateTimeTextContainer}>
                          <Text style={styles.dateTimeText}>
                            {date.toLocaleDateString("en-US", {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                              year: "numeric"
                            })}
                          </Text>
                          <Text style={styles.dateTimeSubtext}>
                            {getDentistHours(date) ? "Clinic is open" : "Select a date"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.dateTimeArrow}>›</Text>
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
                    <Text style={styles.inputLabel}>Appointment Time <Text style={styles.required}>*</Text></Text>
                    <TouchableOpacity
                      style={styles.dateTimeButton}
                      onPress={() => setShowTimePicker(true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dateTimeContent}>
                        <Text style={styles.dateTimeIcon}>🕐</Text>
                        <View style={styles.dateTimeTextContainer}>
                          <Text style={styles.dateTimeText}>
                            {time.toLocaleTimeString([], { 
                              hour: "2-digit", 
                              minute: "2-digit",
                              hour12: true 
                            })}
                          </Text>
                          <Text style={styles.dateTimeSubtext}>
                            Select preferred time
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.dateTimeArrow}>›</Text>
                    </TouchableOpacity>
                  </View>

                  {showTimePicker && (
                    <DateTimePicker
                      value={time}
                      mode="time"
                      display="spinner"
                      onChange={onChangeTime}
                      is24Hour={false}
                    />
                  )}

                  {/* Clinic Hours Info */}
                  <View style={styles.clinicInfoCard}>
                    <Text style={styles.clinicInfoIcon}>ℹ️</Text>
                    <View style={styles.clinicInfoContent}>
                      <Text style={styles.clinicInfoText}>
                        Clinic hours for {date.toLocaleDateString('en-US', { weekday: 'long' })}:{' '}
                        {getDentistHours(date) && 
                          `${getDentistHours(date).start}:00 - ${getDentistHours(date).end}:00`
                        }
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Additional Information */}
                <View style={styles.formSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionIcon}>📝</Text>
                    <Text style={styles.sectionTitle}>Additional Notes</Text>
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Special Requests (Optional)</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Any concerns, allergies, or special requirements..."
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>

                {/* Important Notice */}
                <View style={styles.noticeCard}>
                  <Text style={styles.noticeIcon}>ℹ️</Text>
                  <View style={styles.noticeContent}>
                    <Text style={styles.noticeTitle}>Important Reminders</Text>
                    <Text style={styles.noticeText}>
                      • Please arrive 10 minutes before your appointment{'\n'}
                      • Bring a valid ID and health insurance card{'\n'}
                      • Cancel at least 24 hours in advance if needed{'\n'}
                      • You can only book one appointment per day
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      !contactNumber && styles.submitButtonDisabled
                    ]}
                    onPress={submitBooking}
                    activeOpacity={0.8}
                    disabled={!contactNumber}
                  >
                    <Text style={styles.submitButtonText}>
                      Confirm Appointment
                    </Text>
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
    backgroundColor: "#047857",
  },
  header: {
    backgroundColor: "#047857",
    paddingHorizontal: wp(5),
    paddingTop: hp(2),
    paddingBottom: hp(2),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: isLargeDevice ? wp(6) : wp(11),
    height: isLargeDevice ? wp(6) : wp(11),
    borderRadius: isLargeDevice ? wp(3) : wp(5.5),
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  backIcon: {
    fontSize: isLargeDevice ? wp(4) : wp(6),
    color: "#fff",
    fontWeight: "700",
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: wp(3),
  },
  headerTitle: {
    fontSize: isLargeDevice ? wp(4) : isSmallDevice ? wp(6.5) : wp(7.5),
    fontWeight: "800",
    color: "#fff",
    marginBottom: hp(0.3),
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: isLargeDevice ? wp(2) : isSmallDevice ? wp(3.3) : wp(3.5),
    color: "rgba(255, 255, 255, 0.85)",
    fontWeight: "500",
  },
  headerBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: isLargeDevice ? wp(2.5) : wp(4),
    paddingHorizontal: isLargeDevice ? wp(2) : wp(3),
    paddingVertical: isLargeDevice ? hp(0.5) : hp(0.8),
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  headerBadgeText: {
    color: "#fff",
    fontSize: isLargeDevice ? wp(2.5) : wp(4),
    fontWeight: "700",
  },
  clinicHoursBanner: {
    backgroundColor: "#065F46",
    marginHorizontal: wp(5),
    marginTop: hp(1),
    marginBottom: hp(1.5),
    padding: isLargeDevice ? wp(2.5) : wp(3.5),
    borderRadius: isLargeDevice ? wp(2) : wp(3),
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  clinicHoursIcon: {
    fontSize: isLargeDevice ? wp(4) : wp(6),
    marginRight: isLargeDevice ? wp(2) : wp(3),
  },
  clinicHoursContent: {
    flex: 1,
  },
  clinicHoursTitle: {
    color: "#fff",
    fontSize: isLargeDevice ? wp(2.2) : wp(3.5),
    fontWeight: "700",
    marginBottom: hp(0.3),
  },
  clinicHoursText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: isLargeDevice ? wp(1.8) : wp(2.8),
    lineHeight: isLargeDevice ? wp(3) : wp(4),
  },
  gridContainer: {
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: wp(6),
    borderTopRightRadius: wp(6),
    paddingTop: hp(3),
    paddingHorizontal: wp(5),
    paddingBottom: hp(2),
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: hp(2),
  },
  serviceCard: {
    width: isLargeDevice ? '100%' : (screenWidth - wp(14)) / 2,
    backgroundColor: "#fff",
    borderRadius: isLargeDevice ? wp(2.5) : wp(4),
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: isLargeDevice ? hp(2) : 0,
  },
  serviceCardLarge: {
    flexDirection: "row",
    alignItems: "center",
  },
  serviceImage: {
    width: "100%",
    height: hp(13),
    resizeMode: "cover",
  },
  serviceImageLarge: {
    width: isLargeDevice ? wp(25) : wp(30),
    height: hp(18),
    resizeMode: "cover",
  },
  serviceOverlay: {
    position: "absolute",
    top: wp(2.5),
    right: wp(2.5),
  },
  iconBadge: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: "#fff",
  },
  iconBadgeText: {
    fontSize: wp(5),
  },
  iconBadgeLarge: {
    width: isLargeDevice ? wp(8) : wp(12),
    height: isLargeDevice ? wp(8) : wp(12),
    borderRadius: isLargeDevice ? wp(4) : wp(6),
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: "#fff",
  },
  iconBadgeTextLarge: {
    fontSize: isLargeDevice ? wp(4) : wp(6),
  },
  serviceContent: {
    padding: wp(3),
  },
  serviceContentLarge: {
    flex: 1,
    padding: isLargeDevice ? wp(3) : wp(4),
    justifyContent: "space-between",
  },
  serviceHeaderLarge: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: hp(1),
  },
  serviceTitleContainer: {
    flex: 1,
    marginLeft: isLargeDevice ? wp(2) : wp(3),
  },
  serviceTitle: {
    fontSize: isSmallDevice ? wp(4) : wp(4.5),
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: hp(0.8),
  },
  serviceTitleLarge: {
    fontSize: isLargeDevice ? wp(3) : wp(5),
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: hp(0.5),
  },
  serviceDescription: {
    fontSize: isSmallDevice ? wp(3) : wp(3.2),
    color: "#64748B",
    lineHeight: isSmallDevice ? wp(4.5) : wp(5),
    marginBottom: hp(1),
  },
  serviceDescriptionLarge: {
    fontSize: isLargeDevice ? wp(2) : wp(3.5),
    color: "#64748B",
    lineHeight: isLargeDevice ? wp(3.5) : wp(5.5),
  },
  bookBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#047857",
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.8),
    borderRadius: wp(2),
  },
  bookBadgeText: {
    color: "#fff",
    fontSize: isSmallDevice ? wp(3) : wp(3.2),
    fontWeight: "600",
  },
  bookBadgeLarge: {
    alignSelf: "flex-start",
    backgroundColor: "#047857",
    paddingHorizontal: isLargeDevice ? wp(2.5) : wp(3),
    paddingVertical: isLargeDevice ? hp(0.8) : hp(1),
    borderRadius: isLargeDevice ? wp(1.5) : wp(2),
  },
  bookBadgeTextLarge: {
    color: "#fff",
    fontSize: isLargeDevice ? wp(2.2) : wp(3.5),
    fontWeight: "600",
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
    paddingTop: hp(2),
  },
  modalContainerLarge: {
    marginHorizontal: wp(10),
    marginBottom: hp(5),
    borderRadius: wp(4),
    maxHeight: hp(85),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: wp(5),
    paddingBottom: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  modalIconBadge: {
    width: isLargeDevice ? wp(8) : wp(12),
    height: isLargeDevice ? wp(8) : wp(12),
    borderRadius: isLargeDevice ? wp(4) : wp(6),
    justifyContent: "center",
    alignItems: "center",
    marginRight: wp(3),
  },
  modalIconText: {
    fontSize: isLargeDevice ? wp(4) : wp(6),
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: isLargeDevice ? wp(3) : wp(5),
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: hp(0.3),
  },
  modalSubtitle: {
    fontSize: isLargeDevice ? wp(2) : wp(3.2),
    color: "#64748B",
  },
  closeButton: {
    width: isLargeDevice ? wp(5) : wp(8),
    height: isLargeDevice ? wp(5) : wp(8),
    borderRadius: isLargeDevice ? wp(2.5) : wp(4),
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: isLargeDevice ? wp(3) : wp(5),
    color: "#64748B",
    fontWeight: "600",
  },
  modalScroll: {
    paddingHorizontal: wp(5),
    paddingBottom: hp(3),
  },
  serviceDescriptionCard: {
    backgroundColor: "#F8FAFC",
    padding: isLargeDevice ? wp(2.5) : wp(4),
    borderRadius: isLargeDevice ? wp(2) : wp(3),
    marginTop: hp(2),
    marginBottom: hp(2),
  },
  serviceDescriptionTitle: {
    fontSize: isLargeDevice ? wp(2.2) : wp(3.8),
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: hp(1),
  },
  serviceDescriptionFull: {
    fontSize: isLargeDevice ? wp(2) : wp(3.3),
    color: "#64748B",
    lineHeight: isLargeDevice ? wp(3.5) : wp(5.5),
  },
  formSection: {
    marginBottom: hp(2.5),
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: hp(1.5),
  },
  sectionIcon: {
    fontSize: isLargeDevice ? wp(3.5) : wp(5),
    marginRight: wp(2),
  },
  sectionTitle: {
    fontSize: isLargeDevice ? wp(2.5) : wp(4.2),
    fontWeight: "700",
    color: "#1E293B",
  },
  inputGroup: {
    marginBottom: hp(1.5),
  },
  inputLabel: {
    fontSize: isLargeDevice ? wp(2) : wp(3.5),
    fontWeight: "600",
    color: "#475569",
    marginBottom: hp(0.8),
  },
  required: {
    color: "#EF4444",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: isLargeDevice ? wp(1.5) : wp(2.5),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    fontSize: isLargeDevice ? wp(2) : wp(3.8),
    color: "#1E293B",
  },
  disabledInput: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
  },
  disabledInputText: {
    fontSize: isLargeDevice ? wp(2) : wp(3.8),
    color: "#94A3B8",
  },
  textArea: {
    height: hp(12),
    paddingTop: hp(1.5),
  },
  dateTimeButton: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: isLargeDevice ? wp(1.5) : wp(2.5),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateTimeContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dateTimeIcon: {
    fontSize: isLargeDevice ? wp(3) : wp(5),
    marginRight: wp(3),
  },
  dateTimeTextContainer: {
    flex: 1,
  },
  dateTimeText: {
    fontSize: isLargeDevice ? wp(2) : wp(3.5),
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: hp(0.2),
  },
  dateTimeSubtext: {
    fontSize: isLargeDevice ? wp(1.8) : wp(3),
    color: "#64748B",
  },
  dateTimeArrow: {
    fontSize: isLargeDevice ? wp(4) : wp(6),
    color: "#94A3B8",
    fontWeight: "300",
  },
  timeSlotsRow: {
    justifyContent: "space-between",
    marginBottom: hp(1),
  },
  timeSlot: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: isLargeDevice ? wp(1.5) : wp(2),
    paddingVertical: hp(1.2),
    marginHorizontal: wp(1),
    alignItems: "center",
  },
  timeSlotLarge: {
    paddingVertical: hp(1),
  },
  timeSlotSelected: {
    backgroundColor: "#047857",
    borderColor: "#047857",
  },
  timeSlotText: {
    fontSize: isLargeDevice ? wp(1.8) : wp(3.2),
    fontWeight: "600",
    color: "#475569",
  },
  timeSlotTextLarge: {
    fontSize: isLargeDevice ? wp(1.8) : wp(3),
  },
  timeSlotTextSelected: {
    color: "#fff",
  },
  noSlotsContainer: {
    backgroundColor: "#FEF2F2",
    padding: isLargeDevice ? wp(3) : wp(4),
    borderRadius: isLargeDevice ? wp(2) : wp(3),
    alignItems: "center",
    marginTop: hp(1),
  },
  noSlotsIcon: {
    fontSize: isLargeDevice ? wp(6) : wp(10),
    marginBottom: hp(1),
  },
  noSlotsTitle: {
    fontSize: isLargeDevice ? wp(2.2) : wp(4),
    fontWeight: "700",
    color: "#991B1B",
    marginBottom: hp(0.5),
  },
  noSlotsText: {
    fontSize: isLargeDevice ? wp(2) : wp(3.3),
    color: "#DC2626",
    textAlign: "center",
  },
  noticeCard: {
    backgroundColor: "#EFF6FF",
    padding: isLargeDevice ? wp(2.5) : wp(4),
    borderRadius: isLargeDevice ? wp(2) : wp(3),
    flexDirection: "row",
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  noticeIcon: {
    fontSize: isLargeDevice ? wp(3.5) : wp(5),
    marginRight: wp(3),
  },
  noticeContent: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: isLargeDevice ? wp(2.2) : wp(3.8),
    fontWeight: "700",
    color: "#1E40AF",
    marginBottom: hp(0.5),
  },
  noticeText: {
    fontSize: isLargeDevice ? wp(1.8) : wp(3.2),
    color: "#1E40AF",
    lineHeight: isLargeDevice ? wp(3.5) : wp(5),
  },
  buttonContainer: {
    marginTop: hp(1),
  },
  submitButton: {
    backgroundColor: "#047857",
    paddingVertical: hp(1.8),
    borderRadius: isLargeDevice ? wp(1.5) : wp(2.5),
    alignItems: "center",
    marginBottom: hp(1.5),
    shadowColor: "#047857",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: isLargeDevice ? wp(2.2) : wp(4),
    fontWeight: "700",
  },
  cancelButton: {
    backgroundColor: "#F1F5F9",
    paddingVertical: hp(1.8),
    borderRadius: isLargeDevice ? wp(1.5) : wp(2.5),
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#475569",
    fontSize: isLargeDevice ? wp(2.2) : wp(4),
    fontWeight: "600",
  },
});