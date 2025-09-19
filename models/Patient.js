const mongoose = require("mongoose");

const PatientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    dob: Date,
    gender: String,
    address: String,
    allergies: [String],
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", PatientSchema);
