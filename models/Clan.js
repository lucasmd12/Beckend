const mongoose = require("mongoose");

const clanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Clan name is required"],
    unique: true, // Unique within a federation? Consider compound index later if needed.
    trim: true,
  },
  tag: {
    type: String,
    required: [true, "Clan tag is required"],
    unique: true, // Unique across all clans?
    trim: true,
    uppercase: true,
    maxlength: [5, "Clan tag cannot be longer than 5 characters"],
  },
  banner: {
    type: String, // Path to banner image or emoji identifier
    trim: true,
    default: "🛡️", // Default banner/flag
  },
  description: {
    type: String,
    trim: true,
  },
  federation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Federation",
    required: [true, "Clan must belong to a federation"],
  },
  leaders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  }],
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
  // Consider adding limits later, e.g., max members, max clans per federation
}, { timestamps: true });

// Ensure a user can only be a member or leader of one clan at a time?
// This might be better enforced at the application level or via User model update.

module.exports = mongoose.model("Clan", clanSchema);

