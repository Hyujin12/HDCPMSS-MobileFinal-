const mongoose = require("mongoose");

const bookedServiceSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      // Not required for backward compatibility with existing data
    },
    serviceName: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    contactNumber: {
      type: String,
      required: true,
    },
    description: String,
    date: {
      type: String,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    medicalHistory: String,
    allergies: String,
    status: {
      type: String,
      enum: ["pending", "accepted", "completed", "cancelled", "rescheduled"],
      default: "pending",
    },
    cancellationReason: String,
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("BookedService", bookedServiceSchema);
