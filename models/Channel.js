const mongoose = require("mongoose");

const ChannelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Channel name is required"],
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  // Add other fields like channel type (public/private), roles within channel, etc.
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure owner is also part of members upon creation
ChannelSchema.pre("save", function (next) {
  if (this.isNew) {
    // Add owner to members list if not already present
    if (!this.members.includes(this.owner)) {
      this.members.push(this.owner);
    }
  }
  next();
});

module.exports = mongoose.model("Channel", ChannelSchema);
