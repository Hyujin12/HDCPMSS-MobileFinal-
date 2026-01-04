// Load environment variables
require("dotenv").config();

// Import dependencies
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Import route files
const userRoutes = require("./routes/UserRoutes");
const bookedServiceRoutes = require("./routes/BookedServiceRoutes");
const feedbackRoutes = require("./routes/feedback");
const messageRoutes = require('./routes/messages');
// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON bodies

// API Routes
app.use("/api/users", userRoutes);
app.use("/api/booked-services", bookedServiceRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use('/api/messages', messageRoutes);

// Root route for testing
app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

// Connect to MongoDB Atlas
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Atlas connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Start server on Render-assigned port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
