// middleware/auth.js
module.exports = function mockAuth(req, res, next) {
  const uid = req.headers["x-user-id"];
  if (uid) {
    req.user = { id: uid };
  }
  next();
};
