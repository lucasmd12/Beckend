const mongoose = require("mongoose");

const GlobalChatMessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  senderRole: {
    // Role geral do usuário (ADM, leader, sub_leader, user)
    type: String,
    enum: ["ADM", "leader", "sub_leader", "user"], // Exemplo de roles
    default: "user",
  },
  message: {
    type: String,
    required: function () {
      return this.type === "text";
    },
    trim: true,
    maxlength: 1000,
    default: "",
  },
  // Tipos de mensagem: texto, imagem, arquivo, áudio, sistema (expansível)
  type: {
    type: String,
    enum: ["text", "image", "file", "audio", "system"],
    default: "text",
  },
  // URL do arquivo (imagem, arquivo, áudio)
  fileUrl: {
    type: String,
    required: function () {
      return ["image", "file", "audio"].includes(this.type);
    },
    default: null,
  },
  // Marcação de mensagens do sistema (ex: "usuário entrou no chat global")
  systemInfo: {
    type: String,
    default: null,
  },
  // Reações (expansível)
  reactions: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      emoji: { type: String },
    },
  ],
  // Status de leitura por usuário (expansível)
  readBy: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      readAt: { type: Date, default: Date.now },
    },
  ],
  edited: {
    type: Boolean,
    default: false,
  },
  deleted: {
    type: Boolean,
    default: false,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Index para busca rápida por data (paginando chat)
GlobalChatMessageSchema.index({ timestamp: -1 });
GlobalChatMessageSchema.index({ sender: 1 });
GlobalChatMessageSchema.index({ type: 1 });

module.exports = mongoose.model("GlobalChatMessage", GlobalChatMessageSchema);


