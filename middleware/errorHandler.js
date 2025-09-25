// middleware/errorHandler.js
module.exports = function errorHandler(err, req, res, next) {
  console.error(err); // log server-side (expand to a logger in future)

  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  // optional: don't leak stack in production
  const payload = { error: message };
  if (process.env.NODE_ENV !== "production") {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
};
