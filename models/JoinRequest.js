const mongoose = require("mongoose");

const JoinRequestSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["clan", "federation"],
    required: true,
  },
  target: { // Clã ou federação
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "type"
  },
  requester: { // Quem solicitou a entrada
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "withdrawn"],
    default: "pending"
  },
  createdAt: { type: Date, default: Date.now },
  respondedAt: { type: Date }
});

// Adicionando índices para campos frequentemente consultados
JoinRequestSchema.index({ type: 1 });
JoinRequestSchema.index({ target: 1 });
JoinRequestSchema.index({ requester: 1 });
JoinRequestSchema.index({ status: 1 });
JoinRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model("JoinRequest", JoinRequestSchema);


