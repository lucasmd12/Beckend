const express = require("express");
const router = express.Router();
const GlobalChannel = require("../models/GlobalChannel");
const { protect: auth } = require("../middleware/authMiddleware");
const { check, validationResult } = require("express-validator");

// @route   GET /api/global-channels
// @desc    Get all global channels
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const globalChannels = await GlobalChannel.find()
      .populate("createdBy", "username avatar")
      .populate("activeUsers", "username avatar");
    res.json(globalChannels);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   GET /api/global-channels/text
// @desc    Get all global text channels
// @access  Private
router.get("/text", auth, async (req, res) => {
  try {
    const textChannels = await GlobalChannel.find({ type: "text" })
      .populate("createdBy", "username avatar");
    res.json(textChannels);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   GET /api/global-channels/voice
// @desc    Get all global voice channels
// @access  Private
router.get("/voice", auth, async (req, res) => {
  try {
    const voiceChannels = await GlobalChannel.find({ type: "voice" })
      .populate("createdBy", "username avatar")
      .populate("activeUsers", "username avatar");
    res.json(voiceChannels);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   POST /api/global-channels
// @desc    Create a new global channel
// @access  Private (Admin only)
router.post(
  "/",
  [
    auth,
    [
      check("name", "Name is required").not().isEmpty(),
      check("type", "Type must be either text or voice").isIn(["text", "voice"]),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Check if user is admin (you may need to implement this check based on your user model)
      // if (req.user.role !== "admin") {
      //   return res.status(401).json({ msg: "Not authorized to create global channels" });
      // }

      const { name, description, type, userLimit } = req.body;

      // Create new global channel
      const newGlobalChannel = new GlobalChannel({
        name,
        description,
        type,
        userLimit: type === "voice" ? (userLimit || 15) : undefined,
        createdBy: req.user.id,
      });

      const globalChannel = await newGlobalChannel.save();
      res.json(globalChannel);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

// @route   PUT /api/global-channels/:id/join
// @desc    Join a global voice channel
// @access  Private
router.put("/:id/join", auth, async (req, res) => {
  try {
    const globalChannel = await GlobalChannel.findById(req.params.id);

    if (!globalChannel) {
      return res.status(404).json({ msg: "Global channel not found" });
    }

    // Only voice channels can be joined
    if (globalChannel.type !== "voice") {
      return res.status(400).json({ msg: "Only voice channels can be joined" });
    }

    // Check if user is already in the channel
    if (globalChannel.activeUsers.includes(req.user.id)) {
      return res.status(400).json({ msg: "User already in this voice channel" });
    }

    // Check if channel is at capacity
    if (globalChannel.activeUsers.length >= globalChannel.userLimit) {
      return res.status(400).json({ msg: "Voice channel is at capacity" });
    }

    // Add user to active users
    globalChannel.activeUsers.push(req.user.id);
    await globalChannel.save();

    const updatedGlobalChannel = await GlobalChannel.findById(req.params.id)
      .populate("createdBy", "username avatar")
      .populate("activeUsers", "username avatar");

    res.json(updatedGlobalChannel);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   PUT /api/global-channels/:id/leave
// @desc    Leave a global voice channel
// @access  Private
router.put("/:id/leave", auth, async (req, res) => {
  try {
    const globalChannel = await GlobalChannel.findById(req.params.id);

    if (!globalChannel) {
      return res.status(404).json({ msg: "Global channel not found" });
    }

    // Only voice channels can be left
    if (globalChannel.type !== "voice") {
      return res.status(400).json({ msg: "Only voice channels can be left" });
    }

    // Check if user is in the channel
    if (!globalChannel.activeUsers.includes(req.user.id)) {
      return res.status(400).json({ msg: "User not in this voice channel" });
    }

    // Remove user from active users
    globalChannel.activeUsers = globalChannel.activeUsers.filter(
      (userId) => userId.toString() !== req.user.id
    );
    await globalChannel.save();

    const updatedGlobalChannel = await GlobalChannel.findById(req.params.id)
      .populate("createdBy", "username avatar")
      .populate("activeUsers", "username avatar");

    res.json(updatedGlobalChannel);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   DELETE /api/global-channels/:id
// @desc    Delete a global channel
// @access  Private (Admin only)
router.delete("/:id", auth, async (req, res) => {
  try {
    const globalChannel = await GlobalChannel.findById(req.params.id);

    if (!globalChannel) {
      return res.status(404).json({ msg: "Global channel not found" });
    }

    // Check if user is admin (you may need to implement this check based on your user model)
    // if (req.user.role !== "admin") {
    //   return res.status(401).json({ msg: "Not authorized to delete global channels" });
    // }

    await globalChannel.remove();
    res.json({ msg: "Global channel removed" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;

