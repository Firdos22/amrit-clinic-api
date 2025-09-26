// models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true }, // hashed
    role: {
      type: String,
      enum: ["admin", "doctor", "receptionist"],
      default: "receptionist",
    },
    refreshTokens: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
