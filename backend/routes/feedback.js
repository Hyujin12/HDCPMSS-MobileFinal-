import express from "express";
import Booking from "../models/BookedService"; // or your appointment model

const router = express.Router();

// GET only completed appointments for a user
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const completed = await Booking.find({
      userId,
      status: "Completed",
    });
    res.json(completed);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// POST feedback
router.post("/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { rating, feedback } = req.body;

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

export default router;
