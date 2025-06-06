const mongoose = require("mongoose");

const FederationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Nome da federação é obrigatório"],
    trim: true,
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
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  subLeaders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
  clans: [{
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Federation", FederationSchema);

