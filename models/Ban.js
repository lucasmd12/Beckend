const mongoose = require("mongoose");

const BanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  targetType: { type: String, enum: ["clan", "federation", "channel"], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "targetType" },
  reason: { type: String, default: "" },
  bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  startAt: { type: Date, default: Date.now },
  endAt: { type: Date }, // null para ban permanente
  active: { type: Boolean, default: true }
});

// Adicionando índices para campos frequentemente consultados
BanSchema.index({ user: 1 });
BanSchema.index({ targetType: 1 });
BanSchema.index({ targetId: 1 });
BanSchema.index({ active: 1 });
BanSchema.index({ user: 1, targetType: 1, targetId: 1 }); // Índice composto para buscas específicas

module.exports = mongoose.model("Ban", BanSchema);


