import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const wp = (percentage) => (screenWidth * percentage) / 100;
const hp = (percentage) => (screenHeight * percentage) / 100;
const isSmallDevice = screenWidth < 375;

export default function AllAppointmentsScreen() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [userId, setUserId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const navigation = useNavigation();

  const BASE_URL = "https://hdcpmss-mobile-1.onrender.com";
  const API_URL = `${BASE_URL}/api/booked-services`;
  const USER_URL = `${BASE_URL}/api/users/profile`;

  useEffect(() => {
    fetchUserAndBookings();
  }, []);

  const fetchUserAndBookings = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");
        setLoading(false);
        return;
      }

      const userRes = await axios.get(USER_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const loggedInUserId = userRes.data._id || userRes.data.id;
      setUserId(loggedInUserId);

      if (!loggedInUserId) {
        throw new Error("User ID not found");
      }

      const bookingsRes = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const allBookings = bookingsRes.data || [];
      const userBookings = allBookings.filter((booking) => {
        return (
          booking.userId === loggedInUserId ||
          booking.user === loggedInUserId ||
          booking.user?._id === loggedInUserId ||
          booking.createdBy === loggedInUserId ||
          booking.patientId === loggedInUserId
        );
      });

      const sortedBookings = userBookings.sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
      });

      setBookings(sortedBookings);
    } catch (error) {
      console.error("Error fetching data:", error);
      Alert.alert("Error", "Could not fetch appointments. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case "accepted":
        return { color: "#10B981", bgColor: "#D1FAE5", label: "Accepted" };
      case "pending":
        return { color: "#F59E0B", bgColor: "#FEF3C7", label: "Pending" };
      case "completed":
        return { color: "#3B82F6", bgColor: "#DBEAFE", label: "Completed" };
      case "cancelled":
        return { color: "#EF4444", bgColor: "#FEE2E2", label: "Cancelled" };
      default:
        return { color: "#6B7280", bgColor: "#F3F4F6", label: status || "Unknown" };
    }
  };

  const handleEdit = (booking) => {
    setSelectedBooking(booking);
    setSelectedDate(booking.date);
    setPhone(booking.phone || "");
    setDescription(booking.description || "");

    if (booking.time) {
      const [timePart, ampm] = booking.time.split(" ");
      const [hoursStr, minutesStr] = timePart.split(":");
      let hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      setSelectedTime(date);
    } else {
      setSelectedTime(new Date());
    }

    setEditModalVisible(true);
  };

  const handleSaveChanges = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return Alert.alert("Unauthorized", "Please log in again.");

      let hours = selectedTime.getHours();
      const minutes = selectedTime.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      const minutesStr = minutes < 10 ? "0" + minutes : minutes;
      const timeString = `${hours}:${minutesStr} ${ampm}`;

      await axios.put(
        `${API_URL}/${selectedBooking._id}`,
        { date: selectedDate, time: timeString, phone, description },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert("✅ Success", "Appointment updated successfully!");
      setEditModalVisible(false);

      setBookings((prev) =>
        prev.map((b) =>
          b._id === selectedBooking._id
            ? { ...b, date: selectedDate, time: timeString, phone, description }
            : b
        )
      );
    } catch (error) {
      console.error("Error updating booking:", error);
      Alert.alert("Error", "Could not update booking.");
    }
  };

  const handleCancel = async (id) => {
    Alert.alert(
      "Cancel Appointment",
      "Are you sure you want to cancel this appointment?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("token");
              if (!token) return Alert.alert("Unauthorized", "Please log in again.");

              await axios.put(
                `${API_URL}/${id}`,
                { status: "cancelled" },
                { headers: { Authorization: `Bearer ${token}` } }
              );

              Alert.alert("✅ Cancelled", "Your appointment has been cancelled.");
              setBookings((prev) =>
                prev.map((b) => (b._id === id ? { ...b, status: "cancelled" } : b))
              );
            } catch (error) {
              console.error("Error cancelling booking:", error);
              Alert.alert("Error", "Could not cancel booking.");
            }
          },
        },
      ]
    );
  };

  const getFilteredBookings = () => {
    if (filterStatus === "all") return bookings;
    return bookings.filter((b) => {
      const bookingStatus = (b.status || '').toLowerCase().trim();
      const filterStatusLower = filterStatus.toLowerCase().trim();
      return bookingStatus === filterStatusLower;
    });
  };

  const filteredBookings = getFilteredBookings();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#048E04" />
        <Text style={styles.loadingText}>Loading appointments...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#048E04" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header with Gradient Effect */}
        <View style={styles.headerContainer}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Appointments</Text>
            <Text style={styles.headerCount}>{bookings.length} Total</Text>
          </View>
        </View>

        {/* Filter Pills */}
        {bookings.length > 0 && (
          <View style={styles.filterWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              {["all", "pending", "accepted", "completed", "cancelled"].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterPill,
                    filterStatus === status && styles.filterPillActive,
                  ]}
                  onPress={() => setFilterStatus(status)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      filterStatus === status && styles.filterPillTextActive,
                    ]}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Appointments List */}
        <View style={styles.listContainer}>
          {filteredBookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>
                {bookings.length === 0 ? "📅" : "🔍"}
              </Text>
              <Text style={styles.emptyTitle}>
                {bookings.length === 0 ? "No Appointments" : `No ${filterStatus} appointments`}
              </Text>
              <Text style={styles.emptySubtitle}>
                {bookings.length === 0
                  ? "Start by booking your first appointment"
                  : "Try selecting a different filter"}
              </Text>
              {bookings.length === 0 && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => navigation.navigate("BookAppointment")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>+ Book Appointment</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={filteredBookings}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const statusConfig = getStatusConfig(item.status);
                return (
                  <View style={styles.card}>
                    {/* Service Header */}
                    <View style={styles.cardTop}>
                      <Text style={styles.serviceTitle} numberOfLines={1}>
                        {item.serviceName}
                      </Text>
                      <View style={[styles.statusChip, { backgroundColor: statusConfig.bgColor }]}>
                        <Text style={[styles.statusChipText, { color: statusConfig.color }]}>
                          {statusConfig.label}
                        </Text>
                      </View>
                    </View>

                    {/* Date & Time Row */}
                    <View style={styles.infoRow}>
                      <View style={styles.infoBox}>
                        <Text style={styles.infoIcon}>📅</Text>
                        <Text style={styles.infoText}>
                          {new Date(item.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                      </View>
                      <View style={styles.infoBox}>
                        <Text style={styles.infoIcon}>🕐</Text>
                        <Text style={styles.infoText}>{item.time}</Text>
                      </View>
                    </View>

                    {/* Patient & Phone */}
                    <View style={styles.detailsBox}>
                      <Text style={styles.detailText}>👤 {item.fullname}</Text>
                      <Text style={styles.detailText}>📞 {item.phone}</Text>
                    </View>

                    {/* Notes */}
                    {item.description && (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesText} numberOfLines={2}>
                          {item.description}
                        </Text>
                      </View>
                    )}

                    {/* Action Buttons */}
                    {(item.status || '').toLowerCase() === "completed" ? (
                      <TouchableOpacity
                        style={styles.viewReceiptBtn}
                        onPress={() => navigation.navigate("Receipt", { booking: item })}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.viewReceiptText}>View Receipt</Text>
                      </TouchableOpacity>
                    ) : (item.status || '').toLowerCase() !== "cancelled" ? (
                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => handleEdit(item)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.editBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.cancelBtn}
                          onPress={() => handleCancel(item._id)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                );
              }}
            />
          )}
        </View>

        {/* Edit Modal */}
        <Modal visible={editModalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Appointment</Text>
                <TouchableOpacity
                  onPress={() => setEditModalVisible(false)}
                  style={styles.closeBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                <View style={styles.modalBody}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Patient Name</Text>
                    <TextInput
                      style={[styles.fieldInput, styles.disabledInput]}
                      value={selectedBooking?.fullname}
                      editable={false}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Email</Text>
                    <TextInput
                      style={[styles.fieldInput, styles.disabledInput]}
                      value={selectedBooking?.email}
                      editable={false}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Select Date</Text>
                    <Calendar
                      onDayPress={(day) => setSelectedDate(day.dateString)}
                      markedDates={{
                        [selectedDate]: {
                          selected: true,
                          selectedColor: "#048E04",
                        },
                      }}
                      theme={{
                        selectedDayBackgroundColor: "#048E04",
                        todayTextColor: "#048E04",
                        arrowColor: "#048E04",
                      }}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Select Time</Text>
                    <TouchableOpacity
                      style={styles.timeSelector}
                      onPress={() => setShowTimePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.timeSelectorText}>
                        🕐 {selectedTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {showTimePicker && (
                    <DateTimePicker
                      value={selectedTime}
                      mode="time"
                      display="default"
                      onChange={(event, time) => {
                        setShowTimePicker(false);
                        if (time) setSelectedTime(time);
                      }}
                    />
                  )}

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Contact Number</Text>
                    <TextInput
                      placeholder="Enter phone number"
                      style={styles.fieldInput}
                      value={phone}
                      keyboardType="phone-pad"
                      onChangeText={setPhone}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Notes (Optional)</Text>
                    <TextInput
                      placeholder="Add notes or special requests..."
                      style={[styles.fieldInput, styles.textAreaInput]}
                      multiline
                      numberOfLines={4}
                      value={description}
                      onChangeText={setDescription}
                      textAlignVertical="top"
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSaveChanges}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#048E04",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  loadingText: {
    marginTop: hp(2),
    fontSize: wp(4),
    color: "#666",
  },
  headerContainer: {
    backgroundColor: "#048E04",
    paddingBottom: hp(3),
  },
  headerContent: {
    paddingHorizontal: wp(5),
    paddingTop: hp(2),
  },
  headerTitle: {
    fontSize: wp(7),
    fontWeight: "800",
    color: "#fff",
    marginBottom: hp(0.5),
  },
  headerCount: {
    fontSize: wp(3.5),
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "600",
  },
  filterWrapper: {
    backgroundColor: "#048E04",
    paddingBottom: hp(2),
  },
  filterScroll: {
    paddingHorizontal: wp(5),
  },
  filterPill: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    borderRadius: wp(6),
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginRight: wp(2),
  },
  filterPillActive: {
    backgroundColor: "#fff",
  },
  filterPillText: {
    fontSize: wp(3.5),
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
  },
  filterPillTextActive: {
    color: "#048E04",
  },
  listContainer: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    borderTopLeftRadius: wp(6),
    borderTopRightRadius: wp(6),
    marginTop: -hp(2),
  },
  listContent: {
    padding: wp(5),
    paddingTop: hp(3),
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: wp(4),
    padding: wp(4),
    marginBottom: hp(2),
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp(1.5),
  },
  serviceTitle: {
    fontSize: wp(4.5),
    fontWeight: "700",
    color: "#1a1a1a",
    flex: 1,
    marginRight: wp(2),
  },
  statusChip: {
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
    borderRadius: wp(4),
  },
  statusChipText: {
    fontSize: wp(3),
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    gap: wp(3),
    marginBottom: hp(1.5),
  },
  infoBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    padding: wp(3),
    borderRadius: wp(3),
  },
  infoIcon: {
    fontSize: wp(4.5),
    marginRight: wp(2),
  },
  infoText: {
    fontSize: wp(3.5),
    fontWeight: "600",
    color: "#333",
  },
  detailsBox: {
    backgroundColor: "#F9F9F9",
    padding: wp(3),
    borderRadius: wp(3),
    marginBottom: hp(1),
  },
  detailText: {
    fontSize: wp(3.5),
    color: "#555",
    marginBottom: hp(0.5),
  },
  notesBox: {
    backgroundColor: "#FFF9E6",
    padding: wp(3),
    borderRadius: wp(3),
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
    marginBottom: hp(1.5),
  },
  notesText: {
    fontSize: wp(3.2),
    color: "#666",
    lineHeight: wp(5),
  },
  actionsRow: {
    flexDirection: "row",
    gap: wp(3),
    marginTop: hp(1),
  },
  editBtn: {
    flex: 1,
    backgroundColor: "#3B82F6",
    paddingVertical: hp(1.3),
    borderRadius: wp(3),
    alignItems: "center",
  },
  editBtnText: {
    color: "#fff",
    fontSize: wp(3.8),
    fontWeight: "700",
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: hp(1.3),
    borderRadius: wp(3),
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#EF4444",
  },
  cancelBtnText: {
    color: "#EF4444",
    fontSize: wp(3.8),
    fontWeight: "700",
  },
  viewReceiptBtn: {
    backgroundColor: "#0EA5E9",
    paddingVertical: hp(1.3),
    borderRadius: wp(3),
    alignItems: "center",
    marginTop: hp(1),
  },
  viewReceiptText: {
    color: "#fff",
    fontSize: wp(3.8),
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: hp(10),
  },
  emptyIcon: {
    fontSize: wp(16),
    marginBottom: hp(2),
  },
  emptyTitle: {
    fontSize: wp(5.5),
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: hp(1),
  },
  emptySubtitle: {
    fontSize: wp(3.8),
    color: "#666",
    marginBottom: hp(3),
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#048E04",
    paddingHorizontal: wp(8),
    paddingVertical: hp(1.8),
    borderRadius: wp(8),
    elevation: 3,
    shadowColor: "#048E04",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: wp(4),
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: "#fff",
    borderTopLeftRadius: wp(6),
    borderTopRightRadius: wp(6),
    maxHeight: hp(85),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: wp(5),
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  modalTitle: {
    fontSize: wp(5.5),
    fontWeight: "700",
    color: "#1a1a1a",
  },
  closeBtn: {
    width: wp(9),
    height: wp(9),
    borderRadius: wp(4.5),
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: wp(5),
    color: "#666",
  },
  modalScroll: {
    maxHeight: hp(70),
  },
  modalBody: {
    padding: wp(5),
  },
  fieldGroup: {
    marginBottom: hp(2.5),
  },
  fieldLabel: {
    fontSize: wp(3.8),
    fontWeight: "600",
    color: "#333",
    marginBottom: hp(1),
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: wp(3),
    padding: wp(3.5),
    fontSize: wp(3.8),
    color: "#1a1a1a",
    backgroundColor: "#fff",
  },
  disabledInput: {
    backgroundColor: "#F9F9F9",
    color: "#999",
  },
  textAreaInput: {
    minHeight: hp(10),
    textAlignVertical: "top",
  },
  timeSelector: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: wp(3),
    padding: wp(3.5),
    backgroundColor: "#F9F9F9",
    alignItems: "center",
  },
  timeSelectorText: {
    fontSize: wp(3.8),
    fontWeight: "600",
    color: "#333",
  },
  saveBtn: {
    backgroundColor: "#048E04",
    paddingVertical: hp(2),
    borderRadius: wp(3),
    alignItems: "center",
    marginTop: hp(1),
    elevation: 3,
    shadowColor: "#048E04",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: wp(4.2),
    fontWeight: "700",
  },
});