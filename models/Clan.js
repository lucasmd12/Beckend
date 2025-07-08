const mongoose = require("mongoose");

const ClanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Nome do clã é obrigatório"],
    trim: true,
  },
  tag: {
    type: String,
    required: [true, "TAG do clã é obrigatória"],
    trim: true,
    maxlength: [5, "TAG não pode ter mais de 5 caracteres"],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Descrição não pode ter mais de 500 caracteres"],
  },
  banner: {
    type: String, // URL da imagem da bandeira
    default: null,
  },
  flag: {
    type: String, // URL da bandeira do clã
    default: null,
  },
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  subLeaders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
  federation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Federation",
    default: null,
  },
  // Papéis customizados do clã (para cargos especiais, cores, permissões extras)
  customRoles: [{
    name: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      default: "#FFFFFF", // Cor padrão branca
    },
    permissions: {
      manageMembers: { type: Boolean, default: false },
      manageChannels: { type: Boolean, default: false },
      manageRoles: { type: Boolean, default: false },
      kickMembers: { type: Boolean, default: false },
      muteMembers: { type: Boolean, default: false },
      // Adicione outras permissões conforme necessário
    },
  }],
  // Relação de usuários com papéis customizados
  memberRoles: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    roleName: {
      type: String, // Nome do cargo customizado
      required: true,
    },
  }],
  allies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clan",
  }],
  enemies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clan",
  }],
  rules: {
    type: String,
    trim: true,
    maxlength: [1000, "Regras não podem ter mais de 1000 caracteres"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Garantir que o líder também esteja na lista de membros
ClanSchema.pre("save", function (next) {
  if (this.isNew || this.isModified("leader")) {
    if (!this.members.includes(this.leader)) {
      this.members.push(this.leader);
    }
  }
  next();
});

// Adicionando índices para campos frequentemente consultados
ClanSchema.index({ name: 1 });
ClanSchema.index({ tag: 1 });
ClanSchema.index({ leader: 1 });
ClanSchema.index({ federation: 1 });
ClanSchema.index({ members: 1 });

module.exports = mongoose.model("Clan", ClanSchema);


