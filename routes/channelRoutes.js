const express = require("express");
const router = express.Router();
const {
  createChannel,
  getAllChannels,
  getChannelById,
  joinChannel,
  leaveChannel,
  getChannelMessages,
} = require("../controllers/channelController");
const { protect } = require("../middleware/authMiddleware");
const { check } = require("express-validator");

// All channel routes are protected
router.use(protect);

// @route   POST api/channels
// @desc    Create a new channel
// @access  Private
router.post(
  "/",
  [check("name", "Channel name is required").not().isEmpty()],
  createChannel
);

// @route   GET api/channels
// @desc    Get all channels
// @access  Private
router.get("/", getAllChannels);

// @route   GET api/channels/:id
// @desc    Get channel details by ID
// @access  Private
router.get("/:id", getChannelById);

// @route   POST api/channels/:id/join
// @desc    Join a channel
// @access  Private
router.post("/:id/join", joinChannel);

// @route   POST api/channels/:id/leave
// @desc    Leave a channel
// @access  Private
router.post("/:id/leave", leaveChannel);

// @route   GET api/channels/:id/messages
// @desc    Get messages for a channel
// @access  Private (Member only)
router.get("/:id/messages", getChannelMessages);

module.exports = router;
