const mongoose = require("mongoose");

const VoiceChannelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Nome do canal de voz é obrigatório"],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: ""
  },
  // Tipo do canal de voz: global, clã ou federação
  type: {
    type: String,
    enum: ["global", "clan", "federation", "admin"],
    default: "global",
  },
  // NOVO: Controle de acesso
  isPrivate: {
    type: Boolean,
    default: false,
  },
  // NOVO: Senha para salas privadas
  password: {
    type: String,
    default: null,
    select: false, // Não retornar senha por padrão nas consultas
  },
  // NOVO: Configurações de sala
  settings: {
    allowRecording: {
      type: Boolean,
      default: false,
    },
    maxDuration: {
      type: Number,
      default: 0, // 0 = sem limite
    },
    autoDelete: {
      type: Boolean,
      default: true, // Deletar quando vazia
    },
  },
  // Associação opcional com clã
  clan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clan",
    default: null, // Null para canais globais ou de federação
  },
  // Associação opcional com federação
  federation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Federation",
    default: null, // Null para canais globais ou de clã
  },
  // Limite de usuários conectados simultaneamente
  userLimit: {
    type: Number,
    default: 15,
    max: 15,
  },
  // Usuários atualmente ativos no canal de voz
  activeUsers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  // NOVO: Histórico de participantes
  participantHistory: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: {
      type: Date,
      default: null,
    },
  }],
  // Usuário que criou o canal
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // NOVO: Status da sala
  status: {
    type: String,
    enum: ["active", "inactive", "archived"],
    default: "active",
  },
  // NOVO: Estatísticas
  stats: {
    totalJoins: {
      type: Number,
      default: 0,
    },
    totalDuration: {
      type: Number,
      default: 0, // em minutos
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // NOVO: Data de expiração automática
  expiresAt: {
    type: Date,
    default: null,
  },
});

// Índices para performance
VoiceChannelSchema.index({ type: 1, status: 1 });
VoiceChannelSchema.index({ clan: 1, type: 1 });
VoiceChannelSchema.index({ federation: 1, type: 1 });
VoiceChannelSchema.index({ createdBy: 1 });
VoiceChannelSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Middleware para limpeza automática
VoiceChannelSchema.pre('save', function(next) {
  // Se a sala está vazia e tem autoDelete ativo, marcar para expirar em 1 hora
  if (this.settings.autoDelete && this.activeUsers.length === 0 && this.status === 'active') {
    this.expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
  } else if (this.activeUsers.length > 0) {
    this.expiresAt = null; // Remover expiração se há usuários
  }
  
  // Atualizar última atividade
  this.stats.lastActivity = new Date();
  
  next();
});

// Método para verificar senha
VoiceChannelSchema.methods.checkPassword = function(password) {
  if (!this.isPrivate) return true;
  return this.password === password;
};

// Método para adicionar participante
VoiceChannelSchema.methods.addParticipant = function(userId) {
  if (!this.activeUsers.includes(userId)) {
    this.activeUsers.push(userId);
    this.participantHistory.push({
      user: userId,
      joinedAt: new Date(),
    });
    this.stats.totalJoins += 1;
  }
};

// Método para remover participante
VoiceChannelSchema.methods.removeParticipant = function(userId) {
  this.activeUsers = this.activeUsers.filter(id => !id.equals(userId));
  
  // Atualizar histórico
  const historyEntry = this.participantHistory.find(
    entry => entry.user.equals(userId) && !entry.leftAt
  );
  if (historyEntry) {
    historyEntry.leftAt = new Date();
  }
};

module.exports = mongoose.model("VoiceChannel", VoiceChannelSchema);
