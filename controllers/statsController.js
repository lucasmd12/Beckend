const User = require("../models/User");
const Call = require("../models/Call");
const Message = require("../models/Message");
const Clan = require("../models/Clan");
const Federation = require("../models/Federation");

exports.getGlobalStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineUsers = await User.countDocuments({
      $or: [
        { status: "online" },
        { ultimaAtividade: { $gte: fiveMinutesAgo } }
      ]
    });
    
    const activeCalls = await Call.countDocuments({
      status: "active"
    });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalMessages = await Message.countDocuments({
      createdAt: { $gte: today }
    });
    
    const activeClans = await User.distinct("clan").then(clans => 
      clans.filter(clan => clan != null).length
    );

    const activeFederations = await User.distinct("federation").then(federations => 
      federations.filter(federation => federation != null).length
    );

    let activeMissions = 0;
    try {
      const Mission = require("../models/Mission");
      activeMissions = await Mission.countDocuments({ status: "active" });
    } catch (e) {
      activeMissions = 3; // Mock se o modelo de Missão não existir
    }

    const stats = {
      totalUsers,
      onlineUsers,
      activeClans,
      activeFederations, // Adicionado
      activeCalls,
      activeMissions,
      totalMessages,
      lastUpdated: new Date()
    };

    res.json(stats);
  } catch (error) {
    console.error("Erro ao buscar estatísticas globais:", error);
    res.status(500).json({ 
      msg: "Erro interno do servidor",
      error: error.message 
    });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.id !== userId && req.user.role !== "ADM") {
      return res.status(403).json({ msg: "Acesso negado" });
    }
    
    const totalCalls = await Call.countDocuments({
      $or: [
        { callerId: userId },
        { receiverId: userId }
      ]
    });
    
    const totalMessages = await Message.countDocuments({
      senderId: userId
    });
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }
    
    const now = new Date();
    const lastActivity = user.ultimaAtividade || user.createdAt;
    const timeDiff = now - lastActivity;
    const onlineTimeMinutes = Math.max(0, Math.floor(timeDiff / (1000 * 60)));
    const onlineTimeFormatted = `${Math.floor(onlineTimeMinutes / 60)}h ${onlineTimeMinutes % 60}m`;
    
    const userStats = {
      totalCalls,
      totalMessages,
      onlineTime: onlineTimeFormatted,
      onlineTimeMinutes,
      memberSince: user.createdAt,
      lastSeen: user.ultimaAtividade,
      status: user.status
    };

    res.json(userStats);
  } catch (error) {
    console.error("Erro ao buscar estatísticas do usuário:", error);
    res.status(500).json({ 
      msg: "Erro interno do servidor",
      error: error.message 
    });
  }
};


