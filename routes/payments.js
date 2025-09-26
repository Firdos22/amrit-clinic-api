const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Visit = require("../models/VisitSchema");

const rz = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

// create order for a visit(amount)
// router.post("/create-order/:visitId", async (req, res) => {
//   try {
//     const { visitId } = req.params;
//     const visit = await VisitSchema.findById(visitId);
//     if (!visit) return res.status(404).json({ error: "Visit not found" });

//     const amount = Math.round(
//       (visit.bill && visit.bill.total ? visit.bill.total : 0) * 100
//     );

//     const order = await rz.orders.create({
//       amount,
//       currency: "INR",
//       receipt: `visit_${visitId}`,
//     });

//     // optionally store order.id in visit.paymentRef or separate Payment collection
//     visit.bill = visit.bill || {};
//     visit.bill.paymentRef = order.id;
//     await visit.save();

//     res.json({ order });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// ensure Visit is required at top: const Visit = require('../models/Visit');

router.post('/create-order/:visitId', async (req, res) => {
  const { visitId } = req.params;
  try {
    console.log('[create-order] called for visitId=', visitId);

    if (!visitId) return res.status(400).json({ error: 'visitId required' });
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_SECRET) {
      return res.status(500).json({ error: 'Razorpay keys not configured on server' });
    }

    const visit = await Visit.findById(visitId);
    if (!visit) return res.status(404).json({ error: 'Visit not found' });

    const total = visit.bill && typeof visit.bill.total === 'number' ? visit.bill.total : null;
    if (total === null || total <= 0) {
      return res.status(400).json({ error: 'Visit bill.total is missing or invalid' });
    }

    const amount = Math.round(total * 100); // paise
    const rz = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET
    });

    const order = await rz.orders.create({
      amount,
      currency: 'INR',
      receipt: `visit_${visitId}`,
      notes: { visitId }
    });

    visit.bill = visit.bill || {};
    visit.bill.paymentRef = order.id;
    await visit.save();

    return res.json({ order });
  } catch (err) {
    console.error('[create-order] ERROR:', err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
});


router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    // verify signature then update Visit / Payment record accordingly
    res.status(200).send("ok");
  }
);

router.post("/confirm", async (req, res) => {
  try {
    const {
      visitId,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = req.body;
    if (
      !visitId ||
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // compute expected signature
    const secret = process.env.RAZORPAY_SECRET;
    const shash = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (shash !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    // find visit
    const visit = await VisitSchema.findById(visitId);
    if (!visit) return res.status(404).json({ error: "Visit not found" });

    // update visit billing
    visit.bill = visit.bill || {};
    visit.bill.paymetStatus = "paid";
    visit.bill.paymentRef = razorpay_payment_id;
    visit.bill.paymentOrderId = razorpay_order_id;
    await visit.save();

    return res.json({
      success: true,
      message: "Payment confirmed and visit updated",
    });
  } catch (err) {
    console.error("POST /payments/confirm error", err);
    return res.status(500).json({ error: err.message });
  }
});
module.exports = router;
