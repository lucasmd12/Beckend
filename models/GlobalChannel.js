const mongoose = require("mongoose");

const GlobalChannelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Global channel name is required"],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    enum: ["text", "voice"],
    required: true,
  },
  userLimit: {
    type: Number,
    default: 15, // Default limit of 15 users per voice channel
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

module.exports = mongoose.model("GlobalChannel", GlobalChannelSchema);

