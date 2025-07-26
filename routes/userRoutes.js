const express = require("express");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");
const authorizeSelfOrAdmin = require("../middleware/authorizeSelfOrAdmin");
const userController = require("../controllers/userController");
const router = express.Router();
const fs = require("fs");

/**
 * @swagger
 * tags:
 *   name: Usuários
 *   description: Gerenciamento de perfis de usuários e informações relacionadas
 */

// --------------------------------------------------------------------
// REMOVIDO: Bloco de configuração do Multer e a rota POST /users/:id/foto
// A lógica de upload agora está centralizada em uploadRoutes.js e uploadController.js
// --------------------------------------------------------------------

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Obter todos os usuários
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Limite de usuários por página
 *     responses:
 *       200:
 *         description: Lista de usuários retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     current:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     count:
 *                       type: integer
 *                     totalUsers:
 *                       type: integer
 *       401:
 *         description: Não autorizado, token ausente ou inválido
 *       500:
 *         description: Erro no servidor
 */
router.get("/", protect, userController.getAllUsers);

/**
 * @swagger
 * /api/cla/{id}/membros:
 *   get:
 *     summary: Listar membros de um clã específico
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *     responses:
 *       200:
 *         description: Lista de membros do clã retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 membros:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       username:
 *                         type: string
 *                       fotoPerfil:
 *                         type: string
 *                         nullable: true
 *                         online:
 *                           type: boolean
 *                           description: "Status online do usuário"
 *       403:
 *         description: Proibido, usuário não é membro do clã ou não é ADM
 *       500:
 *         description: Erro no servidor
 */
router.get("/cla/:id/membros", protect, async (req, res) => {
  try {
    const idCla = req.params.id;
    const requestingUser = await User.findById(req.user.id);

    // Permitir só membros do clã ou ADM
    if (
      requestingUser.role !== "ADM" &&
      (!requestingUser.clan || requestingUser.clan.toString() !== idCla)
    ) {
      return res.status(403).json({ error: "Não autorizado a ver membros deste clã." });
    }

    const membros = await User.find({ clan: idCla }).select("username fotoPerfil ultimaAtividade");

    const agora = new Date();
    const membrosFormatados = membros.map((membro) => {
      const ultimaAtividade = membro.ultimaAtividade || new Date(0);
      const minutosInativo = (agora.getTime() - ultimaAtividade.getTime()) / 60000;
      const online = minutosInativo <= 5;
      return {
        username: membro.username,
        fotoPerfil: membro.fotoPerfil || null,
        online: online,
      };
    });

    res.json({ success: true, membros: membrosFormatados });
  } catch (err) {
    res.status(500).json({ error: "Erro interno do servidor ao buscar membros do clã." });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Obter informações de um usuário por ID
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Informações do usuário retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Não autorizado, token ausente ou inválido
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 *   put:
 *     summary: Atualizar informações de perfil de um usuário
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser atualizado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: Novo nome de usuário
 *               bio:
 *                 type: string
 *                 description: Nova biografia do usuário
 *     responses:
 *       200:
 *         description: Perfil do usuário atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Não autorizado, token ausente ou inválido
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar este perfil
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
// Novas rotas usando userController
router.get("/search", protect, userController.searchUsers);
router.get("/online", protect, userController.getOnlineUsers);
router.put("/profile", protect, userController.updateProfile);
router.get("/:id/stats", protect, userController.getUserStats);

// A rota abaixo estava duplicada, a lógica foi movida para o userController.js
// router.get("/users/:id", protect, userController.getUserById);
// router.put("/users/:id", protect, authorizeSelfOrAdmin, async (req, res) => { ... });

/**
 * @swagger
 * /api/users/{id}/status:
 *   put:
 *     summary: Atualizar status online/offline de um usuário
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [online, offline, away, busy]
 *                 description: Novo status do usuário
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 status:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/status", protect, authorizeSelfOrAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['online', 'offline', 'away', 'busy'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Status inválido." });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // Atualizar status e última atividade
    user.status = status;
    user.ultimaAtividade = new Date();
    await user.save();

    res.json({ 
      success: true, 
      message: "Status atualizado com sucesso",
      status: user.status 
    });
  } catch (err) {
    console.error("Erro ao atualizar status do usuário:", err);
    res.status(500).json({ error: "Erro interno do servidor ao atualizar status." });
  }
});

module.exports = router;


/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único do usuário
 *         username:
 *           type: string
 *           description: Nome de usuário único
 *         role:
 *           type: string
 *           description: "Papel do usuário (ex: user, admin, leader)"
 *         avatar:
 *           type: string
 *           description: URL do avatar do usuário
 *           nullable: true
 *         bio:
 *           type: string
 *           description: Biografia do usuário
 *           nullable: true
 *         clan:
 *           type: string
 *           description: ID do clã ao qual o usuário pertence
 *           nullable: true
 *         federation:
 *           type: string
 *           description: ID da federação à qual o usuário pertence
 *           nullable: true
 *         lastSeen:
 *           type: string
 *           format: date-time
 *           description: Última vez que o usuário esteve online
 *         online:
 *           type: boolean
 *           description: Status online do usuário
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d1a"
 *         username: "testuser"
 *         role: "user"
 *         avatar: "https://example.com/avatar.png"
 *         bio: "Um usuário de teste."
 *         clan: "60d5ec49f8c7b7001c8e4d1b"
 *         federation: "60d5ec49f8c7b7001c8e4d1c"
 *         lastSeen: "2023-10-27T10:00:00Z"
 *         online: true
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
