const mongoose = require("mongoose");

const LogSchema = mongoose.Schema(
  {
    level: {
      type: String,
      required: true,
      enum: ["error", "warn", "info", "http", "verbose", "debug", "silly"],
    },
    message: {
      type: String,
      required: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    // Campos adicionais para auditoria
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Pode ser null para logs de sistema
    },
    ipAddress: {
      type: String,
      required: false,
    },
    method: {
      type: String,
      required: false,
    },
    url: {
      type: String,
      required: false,
    },
    userAgent: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Log", LogSchema);


