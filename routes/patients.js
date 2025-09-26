// routes/patients.js
const express = require("express");
const router = express.Router();
const authJwt = require("../middleware/authJwt");
const requireRole = require("../middleware/requireRole");
// temporary in-memory fallback so require doesn't fail if model has issues
let Patient;
try {
  Patient = require("../models/PatientSchema");
} catch (err) {
  console.warn(
    "Warning: could not load Patient model. Using dummy in-memory fallback. Error:",
    err.message
  );
  // fallback simple implementation to avoid crash during early dev
  Patient = {
    _data: [],

    async find(filter = {}) {
      return this._data;
    },

    async findById(id) {
      return this._data.find((p) => p._id === id) || null;
    },

    async create(obj) {
      const newObj = { ...obj, _id: (Math.random() + Date.now()).toString(36) };
      this._data.unshift(newObj);
      return newObj;
    },

    async findByIdAndUpdate(id, obj, opts = {}) {
      const idx = this._data.findIndex((p) => p._id === id);
      if (idx === -1) return null;
      this._data[idx] = { ...this._data[idx], ...obj };
      return this._data[idx];
    },

    async findByIdAndDelete(id) {
      const idx = this._data.findIndex((p) => p._id === id);
      if (idx === -1) return null;
      const [removed] = this._data.splice(idx, 1);
      return removed;
    },
  };
}

// Create patient
router.post("/", authJwt, async (req, res) => {
  try {
    const payload = req.body;
    const saved = await Patient.create(payload);
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all patients (with search + pagination)
router.get("/", authJwt, async (req, res) => {
  try {
    const q = req.query.q || ""; // search query
    const page = Math.max(1, parseInt(req.query.page || "1"));
    const limit = Math.min(1000, parseInt(req.query.limit || "20"));
    const skip = (page - 1) * limit;

    // Search by name, phone, or email
    const filter = q
      ? {
          $or: [
            { name: new RegExp(q, "i") },
            { phone: new RegExp(q, "i") },
            { email: new RegExp(q, "i") },
          ],
        }
      : {};

    const [patients, total] = await Promise.all([
      Patient.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Patient.countDocuments(filter),
    ]);

    res.json({
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      data: patients,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get one
router.get("/:id", async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: "Not found" });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update
router.put("/:id", async (req, res) => {
  try {
    const updated = await Patient.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Patient.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
