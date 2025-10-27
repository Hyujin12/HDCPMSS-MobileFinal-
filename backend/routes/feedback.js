const express = require("express");
const Booking = require("../models/BookedService"); // adjust path if needed
const router = express.Router();

// GET only completed appointments for a user
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const completed = await Booking.find({ userId, status: "Completed" });
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
