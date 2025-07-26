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
      }     ],
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
    enemyClanId: { // Novo campo para o ID do clã inimigo
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clan",
      required: false,
    },
    enemyClanFlagUrl: { // Novo campo para a URL da bandeira do clã inimigo
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QRR", QRRSchema);




// --- QRR State Machine --- //

QRRSchema.methods.transitionTo = async function (newStatus, user, options = {}) {
  const currentStatus = this.status;
  const validTransitions = {
    "pending": ["active", "cancelled", "expired"],
    "active": ["completed", "cancelled", "expired"],
    "completed": [],
    "cancelled": [],
    "expired": []
  };

  // 1. Validação da Transição
  if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(newStatus)) {
    throw new Error(`Transição inválida de ${currentStatus} para ${newStatus}.`);
  }

  // 2. Guards (Condições para Transição)
  switch (newStatus) {
    case "active":
      if (currentStatus !== "pending") {
        throw new Error("QRR só pode ser ativada do status 'pending'.");
      }
      // Adicionar outras condições para ativar (ex: hora de início, líder ativando)
      if (this.startTime > new Date()) {
        throw new Error("QRR não pode ser ativada antes da hora de início.");
      }
      break;
    case "completed":
      if (currentStatus !== "active") {
        throw new Error("QRR só pode ser completada do status 'active'.");
      }
      if (!user) {
        throw new Error("Usuário é necessário para completar a QRR.");
      }
      this.result = { ...this.result, completedAt: new Date(), completedBy: user._id };
      break;
    case "cancelled":
      // Qualquer status pode ser cancelado, mas talvez apenas por criador/líder/ADM
      if (!user) {
        throw new Error("Usuário é necessário para cancelar a QRR.");
      }
      break;
    case "expired":
      if (currentStatus === "completed" || currentStatus === "cancelled") {
        throw new Error("QRR completada ou cancelada não pode expirar.");
      }
      if (this.endTime > new Date()) {
        throw new Error("QRR não pode expirar antes da hora de término.");
      }
      break;
  }

  // 3. Efeitos Colaterais (Side Effects)
  const oldStatus = this.status;
  this.status = newStatus;

  // Disparar eventos ou chamar serviços com base na transição
  // Exemplo: Notificar usuários, logar evento, etc.
  // A lógica de notificação real deve ser implementada em um serviço separado
  console.log(`QRR ${this._id} transicionou de ${oldStatus} para ${newStatus}.`);

  // Salvar a mudança de status
  await this.save();

  // Retornar a instância atualizada
  return this;
};

// Hook para verificar expiração automaticamente antes de salvar
QRRSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    // Se o status foi alterado manualmente, não sobrescrever
    return next();
  }
  // Se o status ainda é pending ou active e a hora de término passou, marcar como expired
  if ((this.status === "pending" || this.status === "active") && this.endTime < new Date()) {
    this.status = "expired";
    console.log(`QRR ${this._id} automaticamente marcada como expired.`);
  }
  next();
});



