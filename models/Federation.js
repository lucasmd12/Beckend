const mongoose = require("mongoose");

const federationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Federation name is required"],
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  // Add other federation-specific fields if needed later
}, { timestamps: true });

module.exports = mongoose.model("Federation", federationSchema);

