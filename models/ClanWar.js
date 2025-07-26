const mongoose = require("mongoose");

const ClanWarSchema = new mongoose.Schema({
  challengerClan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clan",
    required: true,
  },
  challengedClan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clan",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "active", "completed", "cancelled"],
    default: "pending",
  },
  declaredAt: {
    type: Date,
    default: Date.now,
  },
  startedAt: {
    type: Date,
    default: null,
  },
  endedAt: {
    type: Date,
    default: null,
  },
  winnerClan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clan",
    default: null,
  },
  loserClan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clan",
    default: null,
  },
  score: {
    challenger: { type: Number, default: 0 },
    challenged: { type: Number, default: 0 },
  },
  rules: {
    type: String,
    trim: true,
    maxlength: [1000, "Regras da guerra não podem ter mais de 1000 caracteres"],
  },
  evidence: [{
    type: String, // URLs para imagens/vídeos de evidência
  }],
  // Campo para registrar quem declarou a guerra (para auditoria)
  declaredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // Campo para registrar quem aceitou/rejeitou a guerra
  respondedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  // Campo para registrar quem reportou o resultado
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  // Motivo do cancelamento, se aplicável
  cancellationReason: {
    type: String,
    trim: true,
    default: null,
  },
  // Data de atualização
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Adicionando índices para campos frequentemente consultados
ClanWarSchema.index({ challengerClan: 1 });
ClanWarSchema.index({ challengedClan: 1 });
ClanWarSchema.index({ status: 1 });
ClanWarSchema.index({ declaredAt: -1 });

module.exports = mongoose.model("ClanWar", ClanWarSchema);


