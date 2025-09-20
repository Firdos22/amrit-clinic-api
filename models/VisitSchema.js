// visitSchema

const mongoose = require("mongoose");

const PrescriptionSchema = new mongoose.Schema(
  {
    medicineName: { type: String, required: true },
    dose: String,
    frequency: String,
    duration: String,
    instructions: String,
  },
  { _id: false }
);

const BillItemSchema = new mongoose.Schema(
  {
    desc: String,
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const VisitSchemaa = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    date: { type: Date, default: Date.now },
    visitDay: { type: String, index: true },
    symptoms: String,
    diagnosis: String,
    prescriptions: [PrescriptionSchema],
    bill: {
      items: [BillItemSchema],
      total: { type: Number, default: 0 },
      paymetStatus: {
        type: String,
        enum: ["pending", "paid", "partial"],
        default: "pending",
      },
      paymentRef: String,
    },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

VisitSchemaa.index({ patientId: 1, visitDay: 1 }, { unique: true });

VisitSchemaa.pre("save", function (next) {
  try {
    const d = this.date ? new Date(this.date) : new Date();
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    this.visitDay = `${yy}-${mm}-${dd}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("VisitSchema", VisitSchemaa);
