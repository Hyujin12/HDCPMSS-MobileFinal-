const express = require("express");
const router = express.Router();
const BookedService = require("../models/BookedService");

// ✅ Create a new booking
router.post("/", async (req, res) => {
  try {
    const {
      userId,
      serviceName,
      username,
      email,
      phone,
      contactNumber,
      description,
      date,
      time,
      medicalHistory,
      allergies,
    } = req.body;

    // Accept either phone or contactNumber
    const phoneNumber = phone || contactNumber;

    if (!serviceName || !username || !email || !phoneNumber || !date || !time) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const booking = new BookedService({
      userId: userId || req.userId,
      serviceName,
      username,
      email,
      contactNumber: phoneNumber,
      description,
      date,
      time,
      medicalHistory,
      allergies,
      status: "pending",
    });

    await booking.save();

    // Return with both fields for compatibility
    const response = booking.toObject();
    response.phone = response.contactNumber;

    res.status(201).json({
      message: "Booking created successfully",
      booking: response,
    });
  } catch (error) {
    console.error("Error saving booking:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

// ✅ Fetch all bookings with normalized fields
router.get("/", async (req, res) => {
  try {
    console.log("📥 Fetching all bookings...");
    const bookings = await BookedService.find().sort({ createdAt: -1 });

    // Normalize the data to ensure consistency
    const normalizedBookings = bookings.map((booking) => {
      const bookingObj = booking.toObject();
      return {
        ...bookingObj,
        phone: bookingObj.phone || bookingObj.contactNumber,
        status: bookingObj.status || "pending",
      };
    });

    console.log(`✅ Found ${normalizedBookings.length} bookings`);

    // Log first booking for debugging
    if (normalizedBookings.length > 0) {
      console.log("First booking sample:", {
        id: normalizedBookings[0]._id,
        userId: normalizedBookings[0].userId,
        email: normalizedBookings[0].email,
        serviceName: normalizedBookings[0].serviceName,
        status: normalizedBookings[0].status,
      });
    }

    res.status(200).json(normalizedBookings);
  } catch (error) {
    console.error("Error fetching all bookings:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch bookings", details: error.message });
  }
});

// ✅ Fetch bookings by specific user ID
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`📥 Fetching bookings for userId: ${userId}`);

    const bookings = await BookedService.find({ userId }).sort({
      createdAt: -1,
    });

    const normalizedBookings = bookings.map((booking) => {
      const bookingObj = booking.toObject();
      return {
        ...bookingObj,
        phone: bookingObj.phone || bookingObj.contactNumber,
        status: bookingObj.status || "pending",
      };
    });

    console.log(`✅ Found ${normalizedBookings.length} bookings for user`);
    res.status(200).json(normalizedBookings);
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch user bookings", details: error.message });
  }
});

// ✅ Update booking
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Handle phone/contactNumber
    if (updates.phone && !updates.contactNumber) {
      updates.contactNumber = updates.phone;
    }

    // Fetch the existing booking
    const existingBooking = await BookedService.findById(id);
    if (!existingBooking)
      return res.status(404).json({ error: "Booking not found" });

    // If the booking was cancelled and is being edited, change it to rescheduled
    if (
      existingBooking.status === "cancelled" &&
      updates.status !== "cancelled"
    ) {
      updates.status = "rescheduled";
    }

    // If cancelling, ensure cancellationReason is provided
    if (updates.status === "cancelled" && !updates.cancellationReason) {
      return res.status(400).json({ error: "Cancellation reason is required" });
    }

    const updatedBooking = await BookedService.findByIdAndUpdate(id, updates, {
      new: true,
    });

    // Normalize response
    const response = updatedBooking.toObject();
    response.phone = response.contactNumber;

    res.status(200).json(response);
  } catch (error) {
    console.error("Error updating booking:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

// ✅ Delete a booking
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBooking = await BookedService.findByIdAndDelete(id);

    if (!deletedBooking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res
      .status(200)
      .json({ message: "Booking deleted successfully", deletedBooking });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

module.exports = router;
