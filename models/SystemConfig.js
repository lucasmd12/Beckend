const mongoose = require("mongoose");

const SystemConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true }
});

// Adicionando índice para o campo 'key'
SystemConfigSchema.index({ key: 1 });

module.exports = mongoose.model("SystemConfig", SystemConfigSchema);


