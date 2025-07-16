const mongoose = require("mongoose");

const QRRSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      required: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clan",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "completed", "cancelled", "expired"], // Adicionado 'expired'
      default: "pending",
    },
    type: { // Novo campo
      type: String,
      enum: ["mission", "training", "event", "competition", "meeting", "emergency"],
      default: "mission",
    },
    priority: { // Novo campo
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        username: String, // Adicionado para facilitar
        avatar: String, // Adicionado para facilitar
        role: String, // Adicionado para facilitar
        clanRole: String, // Adicionado para facilitar
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        isPresent: { // Novo campo
          type: Boolean,
          default: false,
        },
        markedPresentAt: { // Novo campo
          type: Date,
        },
        performance: { // Novo campo
          type: Map,
          of: mongoose.Schema.Types.Mixed,
        },
      },
    ],
    maxParticipants: {
      type: Number,
      min: 1,
      required: false,
    },
    requiredRoles: [
      {
        type: String,
        enum: ["Leader", "SubLeader", "member", "ADM", "adminReivindicado", "user", "descolado"],
      },
    ],
    rewards: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    requirements: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    result: { // Novo campo
      success: Boolean,
      notes: String,
      evidenceUrls: [String],
      metrics: { type: Map, of: mongoose.Schema.Types.Mixed },
      completedAt: Date,
      completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
    metadata: { // Novo campo
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QRR", QRRSchema);


