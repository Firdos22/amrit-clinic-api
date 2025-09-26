const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const errorHandler = require("./middleware/errorHandler");
const patientRoutes = require("./routes/patients");
const visitRoutes = require("./routes/visits");
// const paymentRoutes = require("./routes/payments");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/patients", patientRoutes);
app.use("/visits", visitRoutes);
app.use("/auth", authRoutes);
// app.use("/payments", paymentRoutes);
// app.use(mockAuth);

// Default route
app.get("/", (req, res) => {
  res.send("Amrit Clinic API is running 🚀");
});

app.use(errorHandler);
// Start server
const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () =>
      console.log(`🚀 Server running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });
