const mongoose = require("mongoose");

const VoiceChannelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Voice channel name is required"],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    enum: ["global", "clan", "federation"],
    default: "global",
  },
  clanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clan",
    default: null, // Null for global channels
  },
  federationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Federation",
    default: null, // Null for global or clan channels
  },
  userLimit: {
    type: Number,
    default: 15, // Default limit of 15 users per channel
    max: 15,
  },
  activeUsers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("VoiceChannel", VoiceChannelSchema);

