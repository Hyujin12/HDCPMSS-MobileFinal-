// routes/feedback.js
const express = require("express");
const Booking = require("../models/BookedService");
const router = express.Router();

// GET all appointments that can receive feedback
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    // Include "Completed" or "Accepted" as eligible for feedback
    const completed = await Booking.find({
      userId,
      status: { $in: ["completed", "accepted"] },
    });
    res.json(completed);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// POST feedback
router.post("/:bookingId", async (req, res) => {
  const { bookingId } = req.params;
  const { rating, feedback } = req.body;
  try {
    const updated = await Booking.findByIdAndUpdate(
      bookingId,
      { $set: { feedback: { rating, feedback } } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Booking not found" });
    res.json({ message: "Feedback saved successfully!", booking: updated });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

module.exports = router;
