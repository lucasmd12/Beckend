console.log("--- Loading authRoutes.js ---"); // Debug log
const express = require("express");
const router = express.Router();
const { registerUser, loginUser, getUserProfile } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { check } = require("express-validator");

// @route   POST api/auth/register
// @desc    Register user (username/password only)
// @access  Public
router.post(
  "/register",
  [
    check("username", "Username is required").not().isEmpty(),
    // Removed email check
    check(
      "password",
      "Please enter a password with 6 or more characters"
    ).isLength({ min: 6 }),
  ],
  (req, res, next) => { // Add log inside route handler
    console.log("--- Route Hit: POST /api/auth/register ---");
    registerUser(req, res, next);
  }
);

// @route   POST api/auth/login
// @desc    Authenticate user & get token (username/password only)
// @access  Public
router.post(
  "/login",
  [
    check("username", "Username is required").not().isEmpty(), // Changed from email to username
    check("password", "Password is required").exists(),
  ],
   (req, res, next) => { // Add log inside route handler
    console.log("--- Route Hit: POST /api/auth/login ---");
    loginUser(req, res, next);
  }
);

// @route   GET api/auth/profile
// @desc    Get user profile
// @access  Private
router.get("/profile", protect, (req, res, next) => { // Add log inside route handler
    console.log("--- Route Hit: GET /api/auth/profile ---");
    getUserProfile(req, res, next);
});

module.exports = router;

