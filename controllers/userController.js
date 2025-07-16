const User = require("../models/User");
const Clan = require("../models/Clan");
const Federation = require("../models/Federation");
const cacheService = require("../services/cacheService");
const logger = require("../utils/logger");

/**
 * @desc    Obter todos os usuários
 * @route   GET /api/users
 * @access  Private
 */
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select("-password")
      .populate("clan", "name tag flag")
      .populate("federation", "name tag")
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort({ username: 1 }); // Ordenar por nome de usuário

    const total = await User.countDocuments();

    res.json({
      users,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: users.length,
        totalUsers: total
      }
    });
  } catch (error) {
    logger.error("Erro ao obter todos os usuários:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

/**
 * @desc    Obter perfil de usuário por ID
 * @route   GET /api/users/:id
 * @access  Private
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar cache primeiro
    const cacheKey = `user:${id}`;
    const cachedUser = await cacheService.get(cacheKey);
    
    if (cachedUser) {
      return res.json(cachedUser);
    }

    const user = await User.findById(id)
      .select("-password")
      .populate("clan", "name tag flag")
      .populate("federation", "name tag");

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    // Atualizar lastSeen
    await User.findByIdAndUpdate(id, { lastSeen: new Date() });

    // Cache por 5 minutos
    await cacheService.set(cacheKey, user, 300);

    res.json(user);
  } catch (error) {
    logger.error("Erro ao obter usuário por ID:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

/**
 * @desc    Buscar usuários
 * @route   GET /api/users/search
 * @access  Private
 */
const searchUsers = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: "Query deve ter pelo menos 2 caracteres" });
    }

    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(q.trim(), "i");

    const users = await User.find({
      $or: [
        { username: searchRegex },
        { email: searchRegex }
      ]
    })
    .select("-password")
    .populate("clan", "name tag")
    .populate("federation", "name tag")
    .skip(parseInt(skip))
    .limit(parseInt(limit))
    .sort({ lastSeen: -1 });

    const total = await User.countDocuments({
      $or: [
        { username: searchRegex },
        { email: searchRegex }
      ]
    });

    res.json({
      users,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: users.length,
        totalUsers: total
      }
    });
  } catch (error) {
    logger.error("Erro ao buscar usuários:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

/**
 * @desc    Atualizar perfil do usuário
 * @route   PUT /api/users/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const { username, avatar, status } = req.body;
    const userId = req.user.id;

    // Verificar se username já existe (se fornecido)
    if (username) {
      const existingUser = await User.findOne({ 
        username, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({ message: "Nome de usuário já está em uso" });
      }
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (avatar) updateData.avatar = avatar;
    if (status) updateData.status = status;
    
    updateData.lastSeen = new Date();

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    )
    .select("-password")
    .populate("clan", "name tag flag")
    .populate("federation", "name tag");

    // Invalidar cache
    await cacheService.del(`user:${userId}`);

    res.json(updatedUser);
  } catch (error) {
    logger.error("Erro ao atualizar perfil:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

/**
 * @desc    Obter usuários online
 * @route   GET /api/users/online
 * @access  Private
 */
const getOnlineUsers = async (req, res) => {
  try {
    // Considerar usuários online se lastSeen foi nos últimos 5 minutos
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const onlineUsers = await User.find({
      lastSeen: { $gte: fiveMinutesAgo }
    })
    .select("username avatar clan federation lastSeen")
    .populate("clan", "name tag")
    .populate("federation", "name tag")
    .sort({ lastSeen: -1 });

    res.json({
      count: onlineUsers.length,
      users: onlineUsers
    });
  } catch (error) {
    logger.error("Erro ao obter usuários online:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

/**
 * @desc    Obter estatísticas do usuário
 * @route   GET /api/users/:id/stats
 * @access  Private
 */
const getUserStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    // Buscar estatísticas relacionadas
    const [clanInfo, federationInfo] = await Promise.all([
      user.clan ? Clan.findById(user.clan).select("name members") : null,
      user.federation ? Federation.findById(user.federation).select("name clans") : null
    ]);

    const stats = {
      user: {
        id: user._id,
        username: user.username,
        joinDate: user.createdAt,
        lastSeen: user.lastSeen,
        role: user.role
      },
      clan: clanInfo ? {
        name: clanInfo.name,
        memberCount: clanInfo.members.length,
        isLeader: clanInfo.leader.toString() === id
      } : null,
      federation: federationInfo ? {
        name: federationInfo.name,
        clanCount: federationInfo.clans.length,
        isLeader: federationInfo.leader.toString() === id
      } : null
    };

    res.json(stats);
  } catch (error) {
    logger.error("Erro ao obter estatísticas do usuário:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

module.exports = {
  getAllUsers, // Adicionado
  getUserById,
  searchUsers,
  updateProfile,
  getOnlineUsers,
  getUserStats
};


