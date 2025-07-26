const mongoose = require("mongoose");

const SystemSettingSchema = new mongoose.Schema({
  maintenanceMode: {
    type: Boolean,
    default: false,
  },
  registrationEnabled: {
    type: Boolean,
    default: true,
  },
  serverRegion: {
    type: String,
    default: "Brasil",
  },
  chatEnabled: {
    type: Boolean,
    default: true,
  },
  voiceEnabled: {
    type: Boolean,
    default: true,
  },
  notificationsEnabled: {
    type: Boolean,
    default: true,
  },
  maxUsersPerClan: {
    type: Number,
    default: 50,
  },
  maxClansPerFederation: {
    type: Number,
    default: 10,
  },
  // Adicione outros campos de configuração conforme necessário
});

module.exports = mongoose.model("SystemSetting", SystemSettingSchema);


