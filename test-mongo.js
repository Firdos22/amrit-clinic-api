// test-mongo.js
const mongoose = require("mongoose");
require("dotenv").config();

(async () => {
  try {
    console.log(
      "Trying to connect to:",
      process.env.MONGO_URI && process.env.MONGO_URI.slice(0, 80) + "..."
    );
    await mongoose.connect(process.env.MONGO_URI); // omit deprecated options
    console.log("Connected ✅");
    await mongoose.disconnect();
  } catch (err) {
    console.error("TEST CONNECT ERROR:", err);
    process.exit(1);
  }
})();
