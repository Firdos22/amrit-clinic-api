// middleware/authJwt.js
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_this";

module.exports = function authJwt(req, res, next) {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader)
    return res.status(401).json({ error: "Authorization header missing" });

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer")
    return res.status(401).json({ error: "Invalid authorization format" });

  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.id,
      role: payload.role,
      name: payload.name,
      email: payload.email,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
