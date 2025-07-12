const mongoose = require("mongoose");

const InviteSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["clan", "federation", "channel"],
    required: true,
  },
  target: { // Clã, federação ou canal
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "type"
  },
  sender: { // Quem convidou
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  recipient: { // Quem recebeu o convite
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "expired"],
    default: "pending"
  },
  createdAt: { type: Date, default: Date.now },
  respondedAt: { type: Date }
});

// Adicionando índices para campos frequentemente consultados
InviteSchema.index({ type: 1 });
InviteSchema.index({ target: 1 });
InviteSchema.index({ sender: 1 });
InviteSchema.index({ recipient: 1 });
InviteSchema.index({ status: 1 });
InviteSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Invite", InviteSchema);


