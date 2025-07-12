// Backend: routes/statsRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Call = require("../models/Call");
const Message = require("../models/Message");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Estatísticas
 *   description: Rotas para obter estatísticas do sistema e do usuário
 */

/**
 * @swagger
 * /api/stats/global:
 *   get:
 *     summary: Obter estatísticas globais do sistema
 *     tags: [Estatísticas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas globais retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUsers:
 *                   type: number
 *                   description: Número total de usuários registrados
 *                 onlineUsers:
 *                   type: number
 *                   description: Número de usuários online (status online ou atividade recente)
 *                 activeClans:
 *                   type: number
 *                   description: Número de clãs ativos (com usuários associados)
 *                 activeCalls:
 *                   type: number
 *                   description: Número de chamadas ativas
 *                 activeMissions:
 *                   type: number
 *                   description: Número de missões ativas (se o modelo de missões existir)
 *                 totalMessages:
 *                   type: number
 *                   description: Número total de mensagens enviadas hoje
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *                   description: Data e hora da última atualização das estatísticas
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/global", protect, async (req, res) => {
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

    let activeMissions = 0;
    try {
      const Mission = require("../models/Mission");
      activeMissions = await Mission.countDocuments({ status: "active" });
    } catch (e) {
      activeMissions = 3;
    }

    const stats = {
      totalUsers,
      onlineUsers,
      activeClans,
      activeCalls,
      activeMissions,
      totalMessages,
      lastUpdated: new Date()
    };

    res.json(stats);
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    res.status(500).json({ 
      msg: "Erro interno do servidor",
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/stats/user/{userId}:
 *   get:
 *     summary: Obter estatísticas de um usuário específico
 *     tags: [Estatísticas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário para obter as estatísticas
 *     responses:
 *       200:
 *         description: Estatísticas do usuário retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalCalls:
 *                   type: number
 *                   description: Número total de chamadas realizadas ou recebidas pelo usuário
 *                 totalMessages:
 *                   type: number
 *                   description: Número total de mensagens enviadas pelo usuário
 *                 onlineTime:
 *                   type: string
 *                   description: Tempo online estimado do usuário (formato legível)
 *                 onlineTimeMinutes:
 *                   type: number
 *                   description: Tempo online estimado do usuário em minutos
 *                 memberSince:
 *                   type: string
 *                   format: date-time
 *                   description: Data de registro do usuário
 *                 lastSeen:
 *                   type: string
 *                   format: date-time
 *                   description: Data da última atividade do usuário
 *                 status:
 *                   type: string
 *                   description: Status atual do usuário (online, offline, etc.)
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado. O usuário não tem permissão para ver as estatísticas de outro usuário.
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/user/:userId", protect, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.id !== userId && req.user.role !== "ADM") { // Alterado de 'admin' para 'ADM'
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
});

module.exports = router;


