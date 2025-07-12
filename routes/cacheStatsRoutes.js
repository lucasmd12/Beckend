const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Clan = require("../models/Clan");
const Federation = require("../models/Federation");
const cacheService = require("../services/cacheService");
const CacheKeys = require("../utils/cacheKeys");
const auth = require("../middleware/auth");

/**
 * @swagger
 * tags:
 *   name: Estatísticas e Cache
 *   description: Rotas para obter estatísticas do sistema e gerenciar o cache
 */

/**
 * @swagger
 * /api/stats/global:
 *   get:
 *     summary: Obter estatísticas globais do sistema
 *     tags: [Estatísticas e Cache]
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
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     global:
 *                       type: object
 *                       properties:
 *                         totalUsers:
 *                           type: number
 *                         totalClans:
 *                           type: number
 *                         totalFederations:
 *                           type: number
 *                         onlineUsers:
 *                           type: number
 *                         offlineUsers:
 *                           type: number
 *                     federations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           clanCount:
 *                             type: number
 *                           memberCount:
 *                             type: number
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                 cached:
 *                   type: boolean
 *                 cacheKey:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/global", auth, async (req, res) => {
  try {
    const cacheKey = CacheKeys.globalStats();
    
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.json({
        ...cachedData,
        cached: true,
        cacheKey
      });
    }

    const [totalUsers, totalClans, totalFederations, onlineUsers] = await Promise.all([
      User.countDocuments({}),
      Clan.countDocuments({}),
      Federation.countDocuments({}),
      User.countDocuments({ isOnline: true })
    ]);

    const federationStats = await Federation.aggregate([
      {
        $lookup: {
          from: "clans",
          localField: "_id",
          foreignField: "federation",
          as: "clans"
        }
      },
      {
        $project: {
          name: 1,
          clanCount: { $size: "$clans" },
          memberCount: {
            $sum: {
              $map: {
                input: "$clans",
                as: "clan",
                in: { $size: "$$clan.members" }
              }
            }
          }
        }
      }
    ]);

    const responseData = {
      success: true,
      data: {
        global: {
          totalUsers,
          totalClans,
          totalFederations,
          onlineUsers,
          offlineUsers: totalUsers - onlineUsers
        },
        federations: federationStats,
        lastUpdated: new Date().toISOString()
      }
    };

    await cacheService.set(cacheKey, responseData, 300);

    res.json(responseData);
  } catch (error) {
    console.error("Erro ao obter estatísticas globais:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
});

/**
 * @swagger
 * /api/stats/online:
 *   get:
 *     summary: Obter contagem e lista de usuários online
 *     tags: [Estatísticas e Cache]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuários online retornados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: number
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           username:
 *                             type: string
 *                           avatar:
 *                             type: string
 *                           federation:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                           clan:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                 cached:
 *                   type: boolean
 *                 cacheKey:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/online", auth, async (req, res) => {
  try {
    const cacheKey = CacheKeys.onlineUsers();
    
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.json({
        ...cachedData,
        cached: true,
        cacheKey
      });
    }

    const onlineCount = await User.countDocuments({ isOnline: true });
    const onlineUsers = await User.find({ isOnline: true })
      .select("username avatar federation clan")
      .populate("federation", "name")
      .populate("clan", "name")
      .lean();

    const responseData = {
      success: true,
      data: {
        count: onlineCount,
        users: onlineUsers,
        lastUpdated: new Date().toISOString()
      }
    };

    await cacheService.set(cacheKey, responseData, 120);

    res.json(responseData);
  } catch (error) {
    console.error("Erro ao obter usuários online:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
});

/**
 * @swagger
 * /api/stats/server:
 *   get:
 *     summary: Obter estatísticas do servidor (apenas Admin)
 *     tags: [Estatísticas e Cache]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas do servidor retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     server:
 *                       type: object
 *                       properties:
 *                         uptime:
 *                           type: number
 *                         memory:
 *                           type: object
 *                           properties:
 *                             rss:
 *                               type: number
 *                             heapTotal:
 *                               type: number
 *                             heapUsed:
 *                               type: number
 *                             external:
 *                               type: number
 *                         nodeVersion:
 *                           type: string
 *                         platform:
 *                           type: string
 *                     cache:
 *                       type: object
 *                       properties:
 *                         health:
 *                           type: string
 *                         metrics:
 *                           type: object
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                 cached:
 *                   type: boolean
 *                 cacheKey:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado. Apenas administradores.
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/server", auth, async (req, res) => {
  try {
    if (req.user.role !== "ADM") { // Alterado de 'admin' para 'ADM'
      return res.status(403).json({ msg: "Acesso negado" });
    }

    const cacheKey = CacheKeys.serverStats();
    
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.json({
        ...cachedData,
        cached: true,
        cacheKey
      });
    }

    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    const cacheHealth = await cacheService.getHealth();
    const cacheMetrics = cacheService.getMetrics();

    const responseData = {
      success: true,
      data: {
        server: {
          uptime: Math.floor(uptime),
          memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            external: Math.round(memoryUsage.external / 1024 / 1024)
          },
          nodeVersion: process.version,
          platform: process.platform
        },
        cache: {
          health: cacheHealth,
          metrics: cacheMetrics
        },
        lastUpdated: new Date().toISOString()
      }
    };

    await cacheService.set(cacheKey, responseData, 60);

    res.json(responseData);
  } catch (error) {
    console.error("Erro ao obter estatísticas do servidor:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
});

/**
 * @swagger
 * /api/stats/cache:
 *   delete:
 *     summary: Limpar o cache (apenas Admin)
 *     tags: [Estatísticas e Cache]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pattern
 *         schema:
 *           type: string
 *         description: Padrão para limpar chaves de cache específicas (opcional)
 *     responses:
 *       200:
 *         description: Cache limpo com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 keysRemoved:
 *                   type: number
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado. Apenas administradores.
 *       500:
 *         description: Erro interno do servidor
 */
router.delete("/cache", auth, async (req, res) => {
  try {
    if (req.user.role !== "ADM") { // Alterado de 'admin' para 'ADM'
      return res.status(403).json({ msg: "Acesso negado" });
    }

    const { pattern } = req.query;
    
    let result;
    if (pattern) {
      result = await cacheService.delPattern(pattern);
    } else {
      result = await cacheService.flush();
    }

    res.json({
      success: true,
      message: pattern ? `Cache pattern '${pattern}' cleared` : "All cache cleared",

