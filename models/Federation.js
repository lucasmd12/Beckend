const mongoose = require("mongoose");

const FederationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Nome da federação é obrigatório"],
    trim: true,
  },
  tag: {
    type: String,
    required: false,
    trim: true,
    maxlength: [10, "TAG não pode ter mais de 10 caracteres"],
    unique: true,
    sparse: true, // Permite valores null/undefined únicos
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
  leader: { // Um único líder para a federação
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  subLeaders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
  clans: [{ // Clãs que pertencem à federação
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clan",
  }],
  rules: {
    type: String,
    trim: true,
    maxlength: [1000, "Regras não podem ter mais de 1000 caracteres"],
  },
  allies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Federation",
  }],
  enemies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Federation",
  }],
  
  // --- CAMPOS ADICIONADOS PARA O TERRITÓRIO NO MAPA ---
  territory: {
    mapX: { // Coordenada X do centro do círculo no mapa
      type: Number,
      default: null
    },
    mapY: { // Coordenada Y do centro do círculo no mapa
      type: Number,
      default: null
    },
    radius: { // Raio (tamanho) do círculo do território
      type: Number,
      default: null
    },
    color: { // Cor de demarcação do território (formato hexadecimal, ex: '#FF0000')
      type: String,
      default: '#FFFFFF'
    }
  },
  // ----------------------------------------------------

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Adicionando índices para campos frequentemente consultados
FederationSchema.index({ name: 1 });
FederationSchema.index({ leader: 1 });
FederationSchema.index({ clans: 1 });

module.exports = mongoose.model("Federation", FederationSchema);
