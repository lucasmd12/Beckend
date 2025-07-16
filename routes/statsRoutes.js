const express = require("express");
const router = express.Router();
const statsController = require("../controllers/statsController");
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
router.get("/global", protect, statsController.getGlobalStats);

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
router.get("/user/:userId", protect, statsController.getUserStats);

module.exports = router;


