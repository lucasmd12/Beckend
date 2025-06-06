const express = require("express");
const router = express.Router();
const VoiceChannel = require("../models/VoiceChannel");
const auth = require("../middleware/authMiddleware");
const { check, validationResult } = require("express-validator");

// @route   GET /api/voice-channels
// @desc    Get all voice channels
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const voiceChannels = await VoiceChannel.find()
      .populate("createdBy", "username avatar")
      .populate("activeUsers", "username avatar");
    res.json(voiceChannels);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   GET /api/voice-channels/global
// @desc    Get all global voice channels
// @access  Private
router.get("/global", auth, async (req, res) => {
  try {
    const globalVoiceChannels = await VoiceChannel.find({ type: "global" })
      .populate("createdBy", "username avatar")
      .populate("activeUsers", "username avatar");
    res.json(globalVoiceChannels);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   GET /api/voice-channels/clan/:clanId
// @desc    Get all voice channels for a specific clan
// @access  Private
router.get("/clan/:clanId", auth, async (req, res) => {
  try {
    const clanVoiceChannels = await VoiceChannel.find({
      type: "clan",
      clanId: req.params.clanId,
    })
      .populate("createdBy", "username avatar")
      .populate("activeUsers", "username avatar");
    res.json(clanVoiceChannels);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   GET /api/voice-channels/federation/:federationId
// @desc    Get all voice channels for a specific federation
// @access  Private
router.get("/federation/:federationId", auth, async (req, res) => {
  try {
    const federationVoiceChannels = await VoiceChannel.find({
      type: "federation",
      federationId: req.params.federationId,
    })
      .populate("createdBy", "username avatar")
      .populate("activeUsers", "username avatar");
    res.json(federationVoiceChannels);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   POST /api/voice-channels
// @desc    Create a new voice channel
// @access  Private
router.post(
  "/",
  [
    auth,
    [
      check("name", "Name is required").not().isEmpty(),
      check("type", "Type is required").isIn(["global", "clan", "federation"]),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, description, type, clanId, federationId, userLimit } = req.body;

      // Create new voice channel
      const newVoiceChannel = new VoiceChannel({
        name,
        description,
        type,
        clanId: type === "clan" ? clanId : null,
        federationId: type === "federation" ? federationId : null,
        userLimit: userLimit || 15,
        createdBy: req.user.id,
      });

      const voiceChannel = await newVoiceChannel.save();
      res.json(voiceChannel);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

// @route   PUT /api/voice-channels/:id/join
// @desc    Join a voice channel
// @access  Private
router.put("/:id/join", auth, async (req, res) => {
  try {
    const voiceChannel = await VoiceChannel.findById(req.params.id);

    if (!voiceChannel) {
      return res.status(404).json({ msg: "Voice channel not found" });
    }

    // Check if user is already in the channel
    if (voiceChannel.activeUsers.includes(req.user.id)) {
      return res.status(400).json({ msg: "User already in this voice channel" });
    }

    // Check if channel is at capacity
    if (voiceChannel.activeUsers.length >= voiceChannel.userLimit) {
      return res.status(400).json({ msg: "Voice channel is at capacity" });
    }

    // Add user to active users
    voiceChannel.activeUsers.push(req.user.id);
    await voiceChannel.save();

    const updatedVoiceChannel = await VoiceChannel.findById(req.params.id)
      .populate("createdBy", "username avatar")
      .populate("activeUsers", "username avatar");

    res.json(updatedVoiceChannel);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   PUT /api/voice-channels/:id/leave
// @desc    Leave a voice channel
// @access  Private
router.put("/:id/leave", auth, async (req, res) => {
  try {
    const voiceChannel = await VoiceChannel.findById(req.params.id);

    if (!voiceChannel) {
      return res.status(404).json({ msg: "Voice channel not found" });
    }

    // Check if user is in the channel
    if (!voiceChannel.activeUsers.includes(req.user.id)) {
      return res.status(400).json({ msg: "User not in this voice channel" });
    }

    // Remove user from active users
    voiceChannel.activeUsers = voiceChannel.activeUsers.filter(
      (userId) => userId.toString() !== req.user.id
    );
    await voiceChannel.save();

    const updatedVoiceChannel = await VoiceChannel.findById(req.params.id)
      .populate("createdBy", "username avatar")
      .populate("activeUsers", "username avatar");

    res.json(updatedVoiceChannel);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   DELETE /api/voice-channels/:id
// @desc    Delete a voice channel
// @access  Private (Admin or creator only)
router.delete("/:id", auth, async (req, res) => {
  try {
    const voiceChannel = await VoiceChannel.findById(req.params.id);

    if (!voiceChannel) {
      return res.status(404).json({ msg: "Voice channel not found" });
    }

    // Check if user is creator or admin
    if (voiceChannel.createdBy.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(401).json({ msg: "Not authorized to delete this channel" });
    }

    await voiceChannel.remove();
    res.json({ msg: "Voice channel removed" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;

