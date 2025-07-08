const mongoose = require("mongoose");

const ChannelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Nome do canal é obrigatório"],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: ""
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // Tipo do canal: 'global', 'federation', 'clan'
  channelType: {
    type: String,
    enum: ["global", "federation", "clan"],
    required: true,
    default: "global"
  },
  // ID da entidade (federationId ou clanId) - null para canais globais
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  // Tipo de mídia: 'voice', 'text', 'both'
  mediaType: {
    type: String,
    enum: ["voice", "text", "both"],
    required: true,
    default: "voice"
  },
  // Associação opcional com clã
  clan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clan",
    default: null,
  },
  // Associação opcional com federação
  federation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Federation",
    default: null,
  },
  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  // Tipo do canal: público, privado, restrito
  type: {
    type: String,
    enum: ["public", "private", "restricted"],
    default: "public"
  },
  // Permissões e cargos customizados por usuário
  memberRoles: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    permissions: {
      manageMessages: { type: Boolean, default: false },
      manageMembers: { type: Boolean, default: false },
      manageChannel: { type: Boolean, default: false },
    }
  }],
  // Configurações específicas para canais de voz
  voiceSettings: {
    maxParticipants: { type: Number, default: 50 },
    requirePermissionToSpeak: { type: Boolean, default: false },
    recordingEnabled: { type: Boolean, default: false },
    qualitySettings: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium"
    }
  },
  // Status do canal
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

// Middleware para atualizar updatedAt
ChannelSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  
  // Garante que o owner sempre estará na lista de membros ao criar o canal
  if (this.isNew) {
    if (!this.members.includes(this.owner)) {
      this.members.push(this.owner);
    }
  }
  next();
});

// Índice composto para garantir unicidade de nome por tipo e entidade
ChannelSchema.index({ name: 1, channelType: 1, entityId: 1 }, { unique: true });

// Adicionando índices para campos frequentemente consultados
ChannelSchema.index({ owner: 1 });
ChannelSchema.index({ clan: 1 });
ChannelSchema.index({ federation: 1 });
ChannelSchema.index({ type: 1 });
ChannelSchema.index({ members: 1 });
ChannelSchema.index({ channelType: 1 });
ChannelSchema.index({ mediaType: 1 });
ChannelSchema.index({ isActive: 1 });

module.exports = mongoose.model("Channel", ChannelSchema);


