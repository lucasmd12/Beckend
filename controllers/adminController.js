const User = require("../models/User");
const Clan = require("../models/Clan");
const Federation = require("../models/Federation");
const Call = require("../models/Call");
const SystemSetting = require("../models/SystemSetting"); // Assumindo que você tem um modelo para configurações
const { validationResult } = require("express-validator");

// Middleware para verificar se é admin (mantido aqui para clareza, mas pode ser movido para um middleware global)
exports.checkAdmin = (req, res, next) => {
  if (req.user.role !== "ADM") {
    return res.status(403).json({ msg: "Acesso negado. Apenas administradores." });
  }
  next();
};

exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalClans = await Clan.countDocuments();
    const totalFederations = await Federation.countDocuments();
    const activeCalls = await Call.countDocuments({ status: { $in: ["ringing", "accepted"] } });
    const onlineUsers = await User.countDocuments({ online: true });

    res.json({
      success: true,
      data: {
        totalUsers,
        totalClans,
        totalFederations,
        activeCalls,
        onlineUsers,
      },
    });
  } catch (error) {
    console.error("Erro ao obter estatísticas do dashboard:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

exports.setUserRole = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { userId } = req.params;
  const { role } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    user.role = role;
    await user.save();

    res.json({ success: true, msg: "Papel do usuário atualizado com sucesso." });
  } catch (error) {
    console.error("Erro ao definir papel do usuário:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    // Remover o usuário de clãs e federações, se houver
    if (user.clan) {
      const clan = await Clan.findById(user.clan);
      if (clan) {
        clan.members = clan.members.filter(memberId => memberId.toString() !== userId);
        if (clan.leader && clan.leader.toString() === userId) {
          clan.leader = null; // Ou lógica para transferir liderança
        }
        clan.subLeaders = clan.subLeaders.filter(subLeaderId => subLeaderId.toString() !== userId);
        await clan.save();
      }
    }
    if (user.federation) {
      const federation = await Federation.findById(user.federation);
      if (federation) {
        federation.members = federation.members.filter(memberId => memberId.toString() !== userId);
        if (federation.leader && federation.leader.toString() === userId) {
          federation.leader = null; // Ou lógica para transferir liderança
        }
        federation.subLeaders = federation.subLeaders.filter(subLeaderId => subLeaderId.toString() !== userId);
        await federation.save();
      }
    }

    await User.deleteOne({ _id: userId });

    res.json({ success: true, msg: "Usuário apagado com sucesso." });
  } catch (error) {
    console.error("Erro ao apagar usuário:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

exports.banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    user.isBanned = true;
    user.banReason = reason || "Sem motivo especificado.";
    await user.save();

    res.json({ success: true, msg: "Usuário banido com sucesso." });
  } catch (error) {
    console.error("Erro ao banir usuário:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

exports.unbanUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    user.isBanned = false;
    user.banReason = null;
    await user.save();

    res.json({ success: true, msg: "Usuário desbanido com sucesso." });
  } catch (error) {
    console.error("Erro ao desbanir usuário:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

exports.suspendUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { userId } = req.params;
    const { durationDays, reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    user.isSuspended = true;
    user.suspensionReason = reason || "Sem motivo especificado.";
    user.suspensionEndDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    await user.save();

    res.json({ success: true, msg: "Usuário suspenso com sucesso." });
  } catch (error) {
    console.error("Erro ao suspender usuário:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

exports.unsuspendUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    user.isSuspended = false;
    user.suspensionReason = null;
    user.suspensionEndDate = null;
    await user.save();

    res.json({ success: true, msg: "Suspensão do usuário removida com sucesso." });
  } catch (error) {
    console.error("Erro ao remover suspensão do usuário:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// Funções para gerenciar configurações do sistema
exports.getSystemSettings = async (req, res) => {
  try {
    const settings = await SystemSetting.findOne(); // Assumindo um único documento de configurações
    res.json(settings || {});
  } catch (error) {
    console.error("Erro ao obter configurações do sistema:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

exports.updateSystemSettings = async (req, res) => {
  try {
    const { maintenanceMode, registrationEnabled, serverRegion, chatEnabled, voiceEnabled, notificationsEnabled, maxUsersPerClan, maxClansPerFederation } = req.body;

    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = new SystemSetting();
    }

    settings.maintenanceMode = maintenanceMode;
    settings.registrationEnabled = registrationEnabled;
    settings.serverRegion = serverRegion;
    settings.chatEnabled = chatEnabled;
    settings.voiceEnabled = voiceEnabled;
    settings.notificationsEnabled = notificationsEnabled;
    settings.maxUsersPerClan = maxUsersPerClan;
    settings.maxClansPerFederation = maxClansPerFederation;

    await settings.save();
    res.json({ success: true, msg: "Configurações do sistema atualizadas com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar configurações do sistema:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// Funções para logs do sistema (exemplo - pode precisar de um modelo de Log)
exports.getSystemLogs = async (req, res) => {
  try {
    // Implementar lógica para buscar logs (ex: de um modelo de Log ou de arquivos de log)
    // Por enquanto, um mock
    const logs = [
      { timestamp: new Date(), level: "INFO", message: "Servidor iniciado com sucesso." },
      { timestamp: new Date(), level: "WARN", message: "Tentativa de login falha para \'usuario_teste\'." },
      { timestamp: new Date(), level: "ERROR", message: "Erro de conexão com o banco de dados." },
    ];
    res.json(logs);
  } catch (error) {
    console.error("Erro ao obter logs do sistema:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

exports.clearSystemLogs = async (req, res) => {
  try {
    // Implementar lógica para limpar logs
    res.json({ success: true, msg: "Logs do sistema limpos com sucesso." });
  } catch (error) {
    console.error("Erro ao limpar logs do sistema:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

exports.createSystemBackup = async (req, res) => {
  try {
    // Implementar lógica para criar backup do sistema
    res.json({ success: true, msg: "Backup do sistema iniciado com sucesso." });
  } catch (error) {
    console.error("Erro ao criar backup do sistema:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

exports.clearSystemCache = async (req, res) => {
  try {
    // Implementar lógica para limpar cache do sistema
    res.json({ success: true, msg: "Cache do sistema limpo com sucesso." });
  } catch (error) {
    console.error("Erro ao limpar cache do sistema:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

exports.restartServer = async (req, res) => {
  try {
    // Implementar lógica para reiniciar o servidor
    res.json({ success: true, msg: "Servidor reiniciado com sucesso." });
  } catch (error) {
    console.error("Erro ao reiniciar servidor:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};


