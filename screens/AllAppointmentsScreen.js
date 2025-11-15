import { Ionicons } from "@expo/vector-icons";
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
  RefreshControl,
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

const DENTIST_HOURS = {
  0: { start: 8, end: 12 },   // Sunday 8 AM - 12 PM
  1: { start: 8, end: 19 },   // Monday 8 AM - 7 PM
  2: { start: 8, end: 19 },   // Tuesday 8 AM - 7 PM
  3: { start: 8, end: 19 },   // Wednesday 8 AM - 7 PM
  4: { start: 8, end: 19 },   // Thursday 8 AM - 7 PM
  5: { start: 8, end: 17 },   // Friday 8 AM - 5 PM
  6: { start: 8, end: 19 },   // Saturday 8 AM - 7 PM
};

export default function AllAppointmentsScreen() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [userId, setUserId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [cancellationReason, setCancellationReason] = useState("");
  const [selectedCancelReason, setSelectedCancelReason] = useState("");

  const navigation = useNavigation();

  const BASE_URL = "https://hdcpmss-mobilefinal-j60e.onrender.com";
  const API_URL = `${BASE_URL}/api/booked-services`;
  const USER_URL = `${BASE_URL}/api/users/profile`;

  const cancelReasons = [
    "Schedule Conflict",
    "Personal Emergency",
    "Found Alternative Service",
    "No Longer Needed",
    "Health Concerns",
    "Other",
  ];

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
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserAndBookings();
  };

  // Helper function to check if a date/time is within clinic hours
  const isWithinClinicHours = (date, time) => {
    const dayOfWeek = new Date(date).getDay(); // 0 (Sun) to 6 (Sat)
    const hours = time.getHours();

    const dayHours = DENTIST_HOURS[dayOfWeek];

    if (!dayHours) return false; // fallback

    return hours >= dayHours.start && hours < dayHours.end;
  };

  const getStatusConfig = (status) => {
    const statusLower = status?.toLowerCase() || "";
    switch (statusLower) {
      case "accepted":
        return { color: "#10B981", bgColor: "#D1FAE5", label: "Accepted", icon: "✓" };
      case "pending":
        return { color: "#F59E0B", bgColor: "#FEF3C7", label: "Pending", icon: "⏱" };
      case "completed":
        return { color: "#3B82F6", bgColor: "#DBEAFE", label: "Completed", icon: "✓✓" };
      case "cancelled":
        return { color: "#EF4444", bgColor: "#FEE2E2", label: "Cancelled", icon: "✕" };
      case "rescheduled":
        return { color: "#8B5CF6", bgColor: "#EDE9FE", label: "Rescheduled", icon: "↻" };
      default:
        return { color: "#6B7280", bgColor: "#F3F4F6", label: status || "Unknown", icon: "?" };
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

      if (!selectedDate || !phone) {
        Alert.alert("Missing Fields", "Please fill in all required fields.");
        return;
      }

      // Check if selected time is within clinic hours
      if (!isWithinClinicHours(selectedDate, selectedTime)) {
        const dayOfWeek = new Date(selectedDate).getDay();
        const dayHours = DENTIST_HOURS[dayOfWeek];
        Alert.alert(
          "Outside Clinic Hours",
          `Selected time is outside of clinic hours for ${selectedDate}. Please choose a time between ${dayHours.start}:00 and ${dayHours.end}:00.`
        );
        return;
      }

      // Convert selectedTime to 12-hour format with AM/PM
      let hours = selectedTime.getHours();
      const minutes = selectedTime.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      const minutesStr = minutes < 10 ? "0" + minutes : minutes;
      const timeString = `${hours}:${minutesStr} ${ampm}`;

      const updateData = { 
        date: selectedDate, 
        time: timeString, 
        phone, 
        description 
      };

      if (selectedBooking.status === "cancelled") {
        updateData.status = "rescheduled";
      }

      await axios.put(
        `${API_URL}/${selectedBooking._id}`,
        updateData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert("✅ Success", "Appointment updated successfully!");
      setEditModalVisible(false);

      setBookings((prev) =>
        prev.map((b) =>
          b._id === selectedBooking._id
            ? { ...b, ...updateData }
            : b
        )
      );
    } catch (error) {
      console.error("Error updating booking:", error);
      Alert.alert("Error", "Could not update booking.");
    }
  };

  const handleCancelPress = (booking) => {
    setSelectedBooking(booking);
    setCancellationReason("");
    setSelectedCancelReason("");
    setCancelModalVisible(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedCancelReason && !cancellationReason) {
      Alert.alert("Required", "Please select or enter a cancellation reason.");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return Alert.alert("Unauthorized", "Please log in again.");

      const reason = selectedCancelReason === "Other" 
        ? cancellationReason 
        : selectedCancelReason;

      await axios.put(
        `${API_URL}/${selectedBooking._id}`,
        { 
          status: "cancelled",
          cancellationReason: reason 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert("✅ Cancelled", "Your appointment has been cancelled.");
      setCancelModalVisible(false);
      
      setBookings((prev) =>
        prev.map((b) => 
          b._id === selectedBooking._id 
            ? { ...b, status: "cancelled", cancellationReason: reason } 
            : b
        )
      );
    } catch (error) {
      console.error("Error cancelling booking:", error);
      Alert.alert("Error", "Could not cancel booking.");
    }
  };

  const getFilteredBookings = () => {
    if (filterStatus === "all") return bookings;
    return bookings.filter((b) => {
      const bookingStatus = (b.status || "").toLowerCase().trim();
      const filterStatusLower = filterStatus.toLowerCase().trim();
      return bookingStatus === filterStatusLower;
    });
  };

  const getStatusCounts = () => {
    return {
      all: bookings.length,
      pending: bookings.filter(b => b.status?.toLowerCase() === "pending").length,
      accepted: bookings.filter(b => b.status?.toLowerCase() === "accepted").length,
      completed: bookings.filter(b => b.status?.toLowerCase() === "completed").length,
      cancelled: bookings.filter(b => b.status?.toLowerCase() === "cancelled").length,
    };
  };

  const filteredBookings = getFilteredBookings();
  const statusCounts = getStatusCounts();

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
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerContent}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={wp(6)} color="#fff" />
              </TouchableOpacity>

              <View style={styles.headerTextWrapper}>
                <Text style={styles.headerTitle}>My Appointments</Text>
                <Text style={styles.headerCount}>
                  {bookings.length} {bookings.length === 1 ? "Appointment" : "Total Appointments"}
                </Text>
              </View>
            </View>

            {/* Stats Cards */}
            {bookings.length > 0 && (
              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{statusCounts.pending}</Text>
                  <Text style={styles.statLabel}>Pending</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{statusCounts.accepted}</Text>
                  <Text style={styles.statLabel}>Accepted</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{statusCounts.completed}</Text>
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
              </View>
            )}
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
                  {statusCounts[status] > 0 && (
                    <View style={[
                      styles.filterBadge,
                      filterStatus === status && styles.filterBadgeActive
                    ]}>
                      <Text style={[
                        styles.filterBadgeText,
                        filterStatus === status && styles.filterBadgeTextActive
                      ]}>
                        {statusCounts[status]}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Appointments List */}
        <View style={styles.listContainer}>
          {filteredBookings.length === 0 ? (
            <ScrollView
              contentContainerStyle={styles.emptyScrollContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#048E04"]} />
              }
            >
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Text style={styles.emptyIcon}>
                    {bookings.length === 0 ? "📅" : "🔍"}
                  </Text>
                </View>
                <Text style={styles.emptyTitle}>
                  {bookings.length === 0 ? "No Appointments Yet" : `No ${filterStatus} appointments`}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {bookings.length === 0
                    ? "Start your health journey by booking your first appointment with us"
                    : "Try selecting a different filter to view other appointments"}
                </Text>
                {bookings.length === 0 && (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => navigation.navigate("BookAppointment")}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle-outline" size={wp(5)} color="#fff" style={styles.buttonIcon} />
                    <Text style={styles.primaryButtonText}>Book Appointment</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          ) : (
            <FlatList
              data={filteredBookings}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#048E04"]} />
              }
              renderItem={({ item }) => {
                const statusConfig = getStatusConfig(item.status);
                const isPast = new Date(item.date) < new Date();

                return (
                  <View style={[styles.card, isPast && styles.cardPast]}>
                    {/* Service Header */}
                    <View style={styles.cardTop}>
                      <View style={styles.serviceTitleContainer}>
                        <Ionicons name="medical" size={wp(5)} color="#048E04" style={styles.serviceIcon} />
                        <Text style={styles.serviceTitle} numberOfLines={2}>
                          {item.serviceName}
                        </Text>
                      </View>
                      <View style={[styles.statusChip, { backgroundColor: statusConfig.bgColor }]}>
                        <Text style={styles.statusIcon}>{statusConfig.icon}</Text>
                        <Text style={[styles.statusChipText, { color: statusConfig.color }]}>
                          {statusConfig.label}
                        </Text>
                      </View>
                    </View>

                    {/* Date & Time Row */}
                    <View style={styles.infoRow}>
                      <View style={styles.infoBox}>
                        <Ionicons name="calendar-outline" size={wp(4.5)} color="#048E04" />
                        <View style={styles.infoTextContainer}>
                          <Text style={styles.infoLabel}>Date</Text>
                          <Text style={styles.infoText}>
                            {new Date(item.date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.infoBox}>
                        <Ionicons name="time-outline" size={wp(4.5)} color="#048E04" />
                        <View style={styles.infoTextContainer}>
                          <Text style={styles.infoLabel}>Time</Text>
                          <Text style={styles.infoText}>{item.time}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Patient & Phone */}
                    <View style={styles.detailsBox}>
                      <View style={styles.detailRow}>
                        <Ionicons name="person-outline" size={wp(4.5)} color="#666" />
                        <Text style={styles.detailText}>{item.username}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Ionicons name="call-outline" size={wp(4.5)} color="#666" />
                        <Text style={styles.detailText}>{item.phone}</Text>
                      </View>
                    </View>

                    {/* Notes */}
                    {item.description && (
                      <View style={styles.notesBox}>
                        <View style={styles.notesHeader}>
                          <Ionicons name="document-text-outline" size={wp(4)} color="#F59E0B" />
                          <Text style={styles.notesTitle}>Notes</Text>
                        </View>
                        <Text style={styles.notesText} numberOfLines={3}>
                          {item.description}
                        </Text>
                      </View>
                    )}

                    {/* Cancellation Reason */}
                    {item.status?.toLowerCase() === "cancelled" && item.cancellationReason && (
                      <View style={styles.cancellationBox}>
                        <View style={styles.cancellationHeader}>
                          <Ionicons name="alert-circle-outline" size={wp(4)} color="#EF4444" />
                          <Text style={styles.cancellationTitle}>Cancellation Reason</Text>
                        </View>
                        <Text style={styles.cancellationText}>{item.cancellationReason}</Text>
                      </View>
                    )}

                    {/* Action Buttons */}
                    {item.status?.toLowerCase() !== "cancelled" && item.status?.toLowerCase() !== "completed" && (
                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => handleEdit(item)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="create-outline" size={wp(4.5)} color="#fff" />
                          <Text style={styles.editBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.cancelBtn}
                          onPress={() => handleCancelPress(item)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close-circle-outline" size={wp(4.5)} color="#EF4444" />
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {item.status?.toLowerCase() === "cancelled" && (
                      <TouchableOpacity
                        style={styles.rescheduleBtn}
                        onPress={() => handleEdit(item)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="refresh-outline" size={wp(4.5)} color="#fff" />
                        <Text style={styles.rescheduleBtnText}>Reschedule</Text>
                      </TouchableOpacity>
                    )}
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
                <View style={styles.modalHeaderLeft}>
                  <Ionicons name="create-outline" size={wp(6)} color="#048E04" />
                  <Text style={styles.modalTitle}>Edit Appointment</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setEditModalVisible(false)}
                  style={styles.closeBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={wp(5)} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                <View style={styles.modalBody}>
                  {/* Patient Name */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      <Ionicons name="person" size={wp(4)} color="#666" /> Patient Name
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, styles.disabledInput]}
                      value={selectedBooking?.username}
                      editable={false}
                    />
                  </View>

                  {/* Email */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      <Ionicons name="mail" size={wp(4)} color="#666" /> Email
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, styles.disabledInput]}
                      value={selectedBooking?.email}
                      editable={false}
                    />
                  </View>

                  {/* Date */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      <Ionicons name="calendar" size={wp(4)} color="#666" /> Select Date *
                    </Text>
                    <Calendar
                      onDayPress={(day) => {
                        // Ensure date is not in the past
                        const selected = new Date(day.dateString);
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        if (selected < today) {
                          Alert.alert("Invalid Date", "Cannot select past dates.");
                          return;
                        }
                        setSelectedDate(day.dateString);
                      }}
                      markedDates={{
                        [selectedDate]: {
                          selected: true,
                          selectedColor: "#048E04",
                        },
                      }}
                      minDate={new Date().toISOString().split("T")[0]}
                      theme={{
                        selectedDayBackgroundColor: "#048E04",
                        todayTextColor: "#048E04",
                        arrowColor: "#048E04",
                        textDayFontWeight: "500",
                        textMonthFontWeight: "bold",
                        textDayHeaderFontWeight: "500",
                      }}
                    />
                  </View>

                  {/* Time */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      <Ionicons name="time" size={wp(4)} color="#666" /> Select Time *
                    </Text>
                    <TouchableOpacity
                      style={styles.timeSelector}
                      onPress={() => setShowTimePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="time-outline" size={wp(5)} color="#048E04" />
                      <Text style={styles.timeSelectorText}>
                        {selectedTime.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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
                        if (!time) return;

                        // Check if selected time is within clinic hours
                        if (!isWithinClinicHours(selectedDate, time)) {
                          const dayOfWeek = new Date(selectedDate).getDay();
                          const dayHours = DENTIST_HOURS[dayOfWeek];
                          Alert.alert(
                            "Outside Clinic Hours",
                            `Selected time is outside of clinic hours for ${selectedDate}. Please choose a time between ${dayHours.start}:00 and ${dayHours.end}:00.`
                          );
                          return;
                        }

                        // Check if time is in future
                        const selectedDateObj = new Date(selectedDate);
                        const selectedDateTime = new Date(
                          selectedDateObj.getFullYear(),
                          selectedDateObj.getMonth(),
                          selectedDateObj.getDate(),
                          time.getHours(),
                          time.getMinutes(),
                          0
                        );
                        if (selectedDateTime < new Date()) {
                          Alert.alert("Invalid Time", "Please select a future time.");
                          return;
                        }

                        setSelectedTime(time);
                      }}
                    />
                  )}

                  {/* Contact Number */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      <Ionicons name="call" size={wp(4)} color="#666" /> Contact Number *
                    </Text>
                    <TextInput
                      placeholder="Enter phone number"
                      placeholderTextColor="#999"
                      style={styles.fieldInput}
                      value={phone}
                      keyboardType="phone-pad"
                      onChangeText={setPhone}
                    />
                  </View>

                  {/* Notes */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      <Ionicons name="document-text" size={wp(4)} color="#666" /> Notes (Optional)
                    </Text>
                    <TextInput
                      placeholder="Add notes or special requests..."
                      placeholderTextColor="#999"
                      style={[styles.fieldInput, styles.textAreaInput]}
                      multiline
                      numberOfLines={4}
                      value={description}
                      onChangeText={setDescription}
                      textAlignVertical="top"
                    />
                  </View>

                  {/* Save Button */}
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSaveChanges}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle" size={wp(5)} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Cancel Modal */}
        <Modal visible={cancelModalVisible} animationType="fade" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.cancelModalBox}>
              <View style={styles.cancelModalHeader}>
                <View style={styles.cancelIconContainer}>
                  <Ionicons name="alert-circle" size={wp(12)} color="#EF4444" />
                </View>
                <Text style={styles.cancelModalTitle}>Cancel Appointment</Text>
                <Text style={styles.cancelModalSubtitle}>
                  Please select a reason for cancelling
                </Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.cancelModalScroll}>
                <View style={styles.cancelModalBody}>
                  {cancelReasons.map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={[
                        styles.reasonOption,
                        selectedCancelReason === reason && styles.reasonOptionSelected,
                      ]}
                      onPress={() => setSelectedCancelReason(reason)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.reasonRadio,
                        selectedCancelReason === reason && styles.reasonRadioSelected,
                      ]}>
                        {selectedCancelReason === reason && (
                          <View style={styles.reasonRadioInner} />
                        )}
                      </View>
                      <Text style={[
                        styles.reasonText,
                        selectedCancelReason === reason && styles.reasonTextSelected,
                      ]}>
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {selectedCancelReason === "Other" && (
                    <View style={styles.otherReasonContainer}>
                      <TextInput
                        placeholder="Please specify your reason..."
                        placeholderTextColor="#999"
                        style={styles.otherReasonInput}
                        multiline
                        numberOfLines={3}
                        value={cancellationReason}
                        onChangeText={setCancellationReason}
                        textAlignVertical="top"
                      />
                    </View>
                  )}

                  <View style={styles.cancelModalActions}>
                    <TouchableOpacity
                      style={styles.cancelModalBtnSecondary}
                      onPress={() => setCancelModalVisible(false)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.cancelModalBtnSecondaryText}>Go Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelModalBtnPrimary}
                      onPress={handleConfirmCancel}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.cancelModalBtnPrimaryText}>Confirm Cancel</Text>
                    </TouchableOpacity>
                  </View>
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
    fontWeight: "500",
  },
  headerContainer: {
    backgroundColor: "#048E04",
    paddingBottom: hp(2),
  },
  headerContent: {
    paddingHorizontal: wp(5),
    paddingTop: hp(2),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: hp(2),
  },
  backButton: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: wp(3),
  },
  headerTextWrapper: {
    flex: 1,
  },
  headerTitle: {
    fontSize: isSmallDevice ? wp(6.5) : wp(7),
    fontWeight: "800",
    color: "#fff",
    marginBottom: hp(0.3),
  },
  headerCount: {
    fontSize: isSmallDevice ? wp(3.2) : wp(3.5),
    color: "rgba(255, 255, 255, 0.85)",
    fontWeight: "500",
  },
  statsContainer: {
    flexDirection: "row",
    gap: wp(3),
    marginTop: hp(1),
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: wp(3),
    padding: wp(3),
    alignItems: "center",
  },
  statNumber: {
    fontSize: wp(6),
    fontWeight: "800",
    color: "#fff",
    marginBottom: hp(0.3),
  },
  statLabel: {
    fontSize: wp(3),
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "600",
  },
  filterWrapper: {
    backgroundColor: "#048E04",
    paddingBottom: hp(2),
  },
  filterScroll: {
    paddingHorizontal: wp(5),
    gap: wp(2),
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
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
    fontSize: isSmallDevice ? wp(3.2) : wp(3.5),
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
  },
  filterPillTextActive: {
    color: "#048E04",
  },
  filterBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: wp(3),
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.2),
    marginLeft: wp(1.5),
    minWidth: wp(5),
    alignItems: "center",
  },
  filterBadgeActive: {
    backgroundColor: "#048E04",
  },
  filterBadgeText: {
    fontSize: wp(2.8),
    fontWeight: "700",
    color: "#fff",
  },
  filterBadgeTextActive: {
    color: "#fff",
  },
  listContainer: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    borderTopLeftRadius: wp(6),
    borderTopRightRadius: wp(6),
    marginTop: -hp(1),
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
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#048E04",
  },
  cardPast: {
    opacity: 0.7,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: hp(2),
    gap: wp(2),
  },
  serviceTitleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: wp(2),
  },
  serviceIcon: {
    marginTop: hp(0.3),
  },
  serviceTitle: {
    flex: 1,
    fontSize: isSmallDevice ? wp(4.2) : wp(4.5),
    fontWeight: "700",
    color: "#1a1a1a",
    lineHeight: wp(6),
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.6),
    borderRadius: wp(4),
    gap: wp(1),
  },
  statusIcon: {
    fontSize: wp(3),
  },
  statusChipText: {
    fontSize: isSmallDevice ? wp(2.8) : wp(3),
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
    backgroundColor: "#F9FAFB",
    padding: wp(3),
    borderRadius: wp(3),
    gap: wp(2),
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: wp(2.8),
    color: "#6B7280",
    fontWeight: "500",
    marginBottom: hp(0.2),
  },
  infoText: {
    fontSize: isSmallDevice ? wp(3.2) : wp(3.5),
    fontWeight: "600",
    color: "#1a1a1a",
  },
  detailsBox: {
    backgroundColor: "#F9FAFB",
    padding: wp(3),
    borderRadius: wp(3),
    marginBottom: hp(1),
    gap: hp(0.8),
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(2),
  },
  detailText: {
    fontSize: isSmallDevice ? wp(3.3) : wp(3.5),
    color: "#374151",
    fontWeight: "500",
  },
  notesBox: {
    backgroundColor: "#FFFBEB",
    padding: wp(3),
    borderRadius: wp(3),
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
    marginBottom: hp(1),
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(1.5),
    marginBottom: hp(0.5),
  },
  notesTitle: {
    fontSize: wp(3.2),
    fontWeight: "600",
    color: "#F59E0B",
  },
  notesText: {
    fontSize: isSmallDevice ? wp(3.2) : wp(3.3),
    color: "#78350F",
    lineHeight: wp(5),
    fontWeight: "500",
  },
  cancellationBox: {
    backgroundColor: "#FEF2F2",
    padding: wp(3),
    borderRadius: wp(3),
    borderLeftWidth: 3,
    borderLeftColor: "#EF4444",
    marginBottom: hp(1),
  },
  cancellationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(1.5),
    marginBottom: hp(0.5),
  },
  cancellationTitle: {
    fontSize: wp(3.2),
    fontWeight: "600",
    color: "#EF4444",
  },
  cancellationText: {
    fontSize: isSmallDevice ? wp(3.2) : wp(3.3),
    color: "#7F1D1D",
    lineHeight: wp(5),
    fontWeight: "500",
  },
  actionsRow: {
    flexDirection: "row",
    gap: wp(3),
    marginTop: hp(1),
  },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3B82F6",
    paddingVertical: hp(1.4),
    borderRadius: wp(3),
    gap: wp(1.5),
    elevation: 2,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  editBtnText: {
    color: "#fff",
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    fontWeight: "700",
  },
  cancelBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: hp(1.4),
    borderRadius: wp(3),
    borderWidth: 1.5,
    borderColor: "#EF4444",
    gap: wp(1.5),
  },
  cancelBtnText: {
    color: "#EF4444",
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    fontWeight: "700",
  },
  rescheduleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8B5CF6",
    paddingVertical: hp(1.4),
    borderRadius: wp(3),
    marginTop: hp(1),
    gap: wp(1.5),
    elevation: 2,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  rescheduleBtnText: {
    color: "#fff",
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    fontWeight: "700",
  },
  emptyScrollContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: hp(8),
    paddingHorizontal: wp(8),
  },
  emptyIconContainer: {
    width: wp(24),
    height: wp(24),
    borderRadius: wp(12),
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: hp(3),
  },
  emptyIcon: {
    fontSize: wp(12),
  },
  emptyTitle: {
    fontSize: isSmallDevice ? wp(5) : wp(5.5),
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: hp(1),
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    color: "#6B7280",
    marginBottom: hp(3),
    textAlign: "center",
    lineHeight: wp(6),
    maxWidth: wp(70),
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#048E04",
    paddingHorizontal: wp(6),
    paddingVertical: hp(1.8),
    borderRadius: wp(8),
    gap: wp(1.5),
    elevation: 4,
    shadowColor: "#048E04",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  buttonIcon: {
    marginRight: wp(0.5),
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: isSmallDevice ? wp(3.8) : wp(4),
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: "#fff",
    borderTopLeftRadius: wp(6),
    borderTopRightRadius: wp(6),
    maxHeight: hp(90),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: wp(5),
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(2),
    flex: 1,
  },
  modalTitle: {
    fontSize: isSmallDevice ? wp(5) : wp(5.5),
    fontWeight: "700",
    color: "#1a1a1a",
  },
  closeBtn: {
    width: wp(9),
    height: wp(9),
    borderRadius: wp(4.5),
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  modalScroll: {
    maxHeight: hp(75),
  },
  modalBody: {
    padding: wp(5),
  },
  fieldGroup: {
    marginBottom: hp(2.5),
  },
  fieldLabel: {
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    fontWeight: "600",
    color: "#374151",
    marginBottom: hp(1),
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: wp(3),
    padding: wp(3.5),
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    color: "#1a1a1a",
    backgroundColor: "#fff",
  },
  disabledInput: {
    backgroundColor: "#F9FAFB",
    color: "#9CA3AF",
  },
  textAreaInput: {
    minHeight: hp(12),
    textAlignVertical: "top",
  },
  timeSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: wp(3),
    padding: wp(3.5),
    backgroundColor: "#F9FAFB",
    gap: wp(2),
  },
  timeSelectorText: {
    fontSize: isSmallDevice ? wp(3.8) : wp(4),
    fontWeight: "600",
    color: "#1a1a1a",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#048E04",
    paddingVertical: hp(2),
    borderRadius: wp(3),
    marginTop: hp(1),
    gap: wp(2),
    elevation: 3,
    shadowColor: "#048E04",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: isSmallDevice ? wp(4) : wp(4.2),
    fontWeight: "700",
  },
  cancelModalBox: {
    backgroundColor: "#fff",
    borderRadius: wp(6),
    marginHorizontal: wp(5),
    marginVertical: "auto",
    maxHeight: hp(80),
  },
  cancelModalHeader: {
    alignItems: "center",
    padding: wp(6),
    paddingTop: hp(4),
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  cancelIconContainer: {
    marginBottom: hp(2),
  },
  cancelModalTitle: {
    fontSize: isSmallDevice ? wp(5.5) : wp(6),
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: hp(1),
    textAlign: "center",
  },
  cancelModalSubtitle: {
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    color: "#6B7280",
    textAlign: "center",
  },
  cancelModalScroll: {
    maxHeight: hp(50),
  },
  cancelModalBody: {
    padding: wp(5),
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: wp(4),
    borderRadius: wp(3),
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    marginBottom: hp(1.5),
    backgroundColor: "#fff",
  },
  reasonOptionSelected: {
    borderColor: "#048E04",
    backgroundColor: "#F0FDF4",
  },
  reasonRadio: {
    width: wp(5.5),
    height: wp(5.5),
    borderRadius: wp(2.75),
    borderWidth: 2,
    borderColor: "#D1D5DB",
    marginRight: wp(3),
    justifyContent: "center",
    alignItems: "center",
  },
  reasonRadioSelected: {
    borderColor: "#048E04",
  },
  reasonRadioInner: {
    width: wp(3),
    height: wp(3),
    borderRadius: wp(1.5),
    backgroundColor: "#048E04",
  },
  reasonText: {
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    color: "#374151",
    fontWeight: "500",
    flex: 1,
  },
  reasonTextSelected: {
    color: "#048E04",
    fontWeight: "600",
  },
  otherReasonContainer: {
    marginBottom: hp(2),
  },
  otherReasonInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: wp(3),
    padding: wp(3.5),
    fontSize: isSmallDevice ? wp(3.5) : wp(3.8),
    color: "#1a1a1a",
    minHeight: hp(10),
    textAlignVertical: "top",
  },
  cancelModalActions: {
    flexDirection: "row",
    gap: wp(3),
    marginTop: hp(2),
  },
  cancelModalBtnSecondary: {
    flex: 1,
    paddingVertical: hp(1.8),
    borderRadius: wp(3),
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  cancelModalBtnSecondaryText: {
    fontSize: isSmallDevice ? wp(3.8) : wp(4),
    fontWeight: "700",
    color: "#374151",
  },
  cancelModalBtnPrimary: {
    flex: 1,
    paddingVertical: hp(1.8),
    borderRadius: wp(3),
    alignItems: "center",
    backgroundColor: "#EF4444",
    elevation: 3,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  cancelModalBtnPrimaryText: {
    fontSize: isSmallDevice ? wp(3.8) : wp(4),
    fontWeight: "700",
    color: "#fff",
  },
});