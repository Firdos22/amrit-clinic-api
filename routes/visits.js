// routes/visits.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Visit = require("../models/VisitSchema");
const Patient = require("../models/PatientSchema");
const PDFDocument = require("pdfkit");
const authJwt = require("../middleware/authJwt");
const requireRole = require("../middleware/requireRole");

// Create a new visit for a patient
router.post("/:patientId", authJwt, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { symptoms, diagnosis, prescriptions, bill } = req.body;

    // Basic validation
    if (!symptoms && !diagnosis && !Array.isArray(prescriptions)) {
      return res.status(400).json({
        error:
          "At least one of symptoms, diagnosis or prescriptions is required",
      });
    }
    if (bill && bill.items && !Array.isArray(bill.items)) {
      return res
        .status(400)
        .json({ error: "bill.items must be an array if provided" });
    }

    // Validate patientId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ error: "Invalid patientId" });
    }

    // Check patient exists
    const existingPatient = await Patient.findById(patientId);
    if (!existingPatient)
      return res.status(404).json({ error: "Patient not found" });

    // Build visitData and attach createdBy if available
    const visitData = { ...req.body, patientId };
    if (req.user && req.user.id) visitData.createdBy = req.user.id;

    // compute bill.total
    if (visitData.bill && Array.isArray(visitData.bill.items)) {
      visitData.bill.total = visitData.bill.items.reduce(
        (sum, item) => sum + (Number(item.amount) || 0),
        0
      );
    }

    const visit = new Visit(visitData);

    try {
      const saved = await visit.save();
      return res.status(201).json(saved);
    } catch (err) {
      // duplicate key (unique index) handling
      if (err && err.code === 11000) {
        return res.status(409).json({
          error: "A visit for this patient already exists for the same day",
        });
      }
      throw err;
    }
  } catch (err) {
    console.error("POST /visits error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Get paginated visits for a patient (most recent first)
// GET /visits/:patientId?page=1&limit=10
router.get("/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ error: "Invalid patientId" });
    }

    const page = Math.max(1, parseInt(req.query.page || "1"));
    const limit = Math.min(100, parseInt(req.query.limit || "10"));
    const skip = (page - 1) * limit;

    const [visits, total] = await Promise.all([
      Visit.find({ patientId })
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Visit.countDocuments({ patientId }),
    ]);

    res.json({
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      data: visits,
    });
  } catch (err) {
    console.error("GET /visits error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get single visit by visitId (with basic patient info)
router.get("/visit/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid visit id" });
    }
    const visit = await Visit.findById(id).populate("patientId", "name phone");
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    res.json(visit);
  } catch (err) {
    console.error("GET /visits/visit/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

//  Generate PDF receipt for a visit
router.get("/visit/:id/receipt", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid visit id" });
    }

    const visit = await Visit.findById(id).populate("patientId");
    if (!visit) return res.status(404).json({ error: "Visit not found" });

    // Setup PDF headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=receipt_${id}.pdf`
    );

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    // Header
    doc.fontSize(18).text("Amrit Clinic", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text("Visit Receipt", { align: "center" });
    doc.moveDown();

    // Patient info
    const patient = visit.patientId || {};
    doc.fontSize(10).text(`Patient: ${patient.name || "N/A"}`);
    doc.text(`Phone: ${patient.phone || "N/A"}`);
    doc.text(`Visit Date: ${new Date(visit.createdAt).toLocaleDateString()}`);
    doc.moveDown();

    // Visit details
    if (visit.diagnosis) doc.text(`Diagnosis: ${visit.diagnosis}`);
    if (visit.symptoms) doc.text(`Symptoms: ${visit.symptoms}`);
    doc.moveDown();

    // Prescriptions
    if (Array.isArray(visit.prescriptions) && visit.prescriptions.length) {
      doc.fontSize(12).text("Prescriptions:");
      visit.prescriptions.forEach((p, i) => {
        doc
          .fontSize(10)
          .text(
            `${i + 1}. ${p.name || p.medicineName} - ${p.dose || ""} (${
              p.duration || ""
            })`
          );
      });
      doc.moveDown();
    }

    // Bill
    if (visit.bill && Array.isArray(visit.bill.items)) {
      doc.fontSize(12).text("Bill:");
      visit.bill.items.forEach((item) => {
        doc.fontSize(10).text(`${item.desc || "Item"} - ₹${item.amount || 0}`);
      });
      doc.moveDown();
      doc
        .fontSize(12)
        .text(`Total: ₹${visit.bill.total || 0}`, { align: "right" });
      doc.text(`Payment Status: ${visit.bill.paymentStatus || "pending"}`, {
        align: "right",
      });
    }

    doc.moveDown(2);
    doc
      .fontSize(9)
      .text("Thank you for visiting Amrit Clinic", { align: "center" });

    doc.end();
  } catch (err) {
    console.error("GET /visits/visit/:id/receipt error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete(
  "/:id",
  authJwt,
  requireRole("doctor", "admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      await Visit.findByIdAndDelete(id);
      res.json({ message: "Visit deleted" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
