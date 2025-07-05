const express = require("express");
const router = express.Router();
const VoiceChannel = require("../models/VoiceChannel");
const { protect } = require("../middleware/authMiddleware");
const { check, validationResult } = require("express-validator");

/**
 * @swagger
 * tags:
 *   name: Canais de Voz
 *   description: Gerenciamento de canais de voz para comunicação em tempo real
 */

// Helper para resposta padrão de erro
const serverError = (res, err) => {
  console.error(err.message);
  return res.status(500).json({ error: "Erro interno do servidor" });
};

/**
 * @swagger
 * /api/voice-channels:
 *   get:
 *     summary: Obter todos os canais de voz
 *     tags: [Canais de Voz]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de todos os canais de voz
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 voiceChannels:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VoiceChannel'
 *       401:
 *         description: Não autorizado, token ausente ou inválido
 *       500:
 *         description: Erro no servidor
 *   post:
 *     summary: Criar um novo canal de voz
 *     tags: [Canais de Voz]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome do canal de voz
 *               description:
 *                 type: string
 *                 description: Descrição do canal de voz
 *                 nullable: true
 *               type:
 *                 type: string
 *                 enum: [global, clan, federation]
 *                 description: Tipo do canal de voz (global, clan, federation)
 *               clanId:
 *                 type: string
 *                 description: ID do clã (obrigatório se type for 'clan')
 *                 nullable: true
 *               federationId:
 *                 type: string
 *                 description: ID da federação (obrigatório se type for 'federation')
 *                 nullable: true
 *               userLimit:
 *                 type: number
 *                 description: Limite de usuários para o canal de voz (padrão 15)
 *                 default: 15
 *     responses:
 *       200:
 *         description: Canal de voz criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 voiceChannel:
 *                   $ref: '#/components/schemas/VoiceChannel'
 *       400:
 *         description: Erro de validação ou canal já existe
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para criar este tipo de canal
 *       500:
 *         description: Erro no servidor
 */
router.get("/", protect, async (req, res) => {
  try {
    const voiceChannels = await VoiceChannel.find()
      .populate("createdBy", "username fotoPerfil")
      .populate("activeUsers", "username fotoPerfil");
    res.json({ success: true, voiceChannels });
  } catch (err) {
    serverError(res, err);
  }
});

router.post(
  "/",
  [
    protect,
    [
      check("name", "Nome é obrigatório").not().isEmpty(),
      check("type", "Tipo é obrigatório e deve ser global, clan ou federation").isIn(["global", "clan", "federation"]),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array() });
    }

    try {
      const { name, description, type, clanId, federationId, userLimit } = req.body;

      // Se for global, só ADM pode criar
      if (type === "global" && req.user.role !== "ROLE_ADM") {
        return res.status(403).json({ error: "Apenas ADM pode criar canais globais." });
      }

      const newVoiceChannel = new VoiceChannel({
        name,
        description,
        type,
        clanId: type === "clan" ? clanId : null,
        federationId: type === "federation" ? federationId : null,
        userLimit: userLimit || 15,
        createdBy: req.user.id,
      });

      const voiceChannel = await newVoiceChannel.save();
      res.json({ success: true, voiceChannel });
    } catch (err) {
      serverError(res, err);
    }
  }
);

/**
 * @swagger
 * /api/voice-channels/global:
 *   get:
 *     summary: Obter canais de voz globais
 *     tags: [Canais de Voz]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de canais de voz globais
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 globalVoiceChannels:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VoiceChannel'
 *       401:
 *         description: Não autorizado, token ausente ou inválido
 *       500:
 *         description: Erro no servidor
 */
router.get("/global", protect, async (req, res) => {
  try {
    const globalVoiceChannels = await VoiceChannel.find({ type: "global" })
      .populate("createdBy", "username fotoPerfil")
      .populate("activeUsers", "username fotoPerfil");
    res.json({ success: true, globalVoiceChannels });
  } catch (err) {
    serverError(res, err);
  }
});

/**
 * @swagger
 * /api/voice-channels/clan/{clanId}:
 *   get:
 *     summary: Obter canais de voz de um clã específico
 *     tags: [Canais de Voz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clanId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *     responses:
 *       200:
 *         description: Lista de canais de voz do clã
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 clanVoiceChannels:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VoiceChannel'
 *       401:
 *         description: Não autorizado, token ausente ou inválido
 *       500:
 *         description: Erro no servidor
 */
router.get("/clan/:clanId", protect, async (req, res) => {
  try {
    const clanVoiceChannels = await VoiceChannel.find({
      type: "clan",
      clanId: req.params.clanId,
    })
      .populate("createdBy", "username fotoPerfil")
      .populate("activeUsers", "username fotoPerfil");
    res.json({ success: true, clanVoiceChannels });
  } catch (err) {
    serverError(res, err);
  }
});

/**
 * @swagger
 * /api/voice-channels/federation/{federationId}:
 *   get:
 *     summary: Obter canais de voz de uma federação específica
 *     tags: [Canais de Voz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: federationId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *     responses:
 *       200:
 *         description: Lista de canais de voz da federação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 federationVoiceChannels:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VoiceChannel'
 *       401:
 *         description: Não autorizado, token ausente ou inválido
 *       500:
 *         description: Erro no servidor
 */
router.get("/federation/:federationId", protect, async (req, res) => {
  try {
    const federationVoiceChannels = await VoiceChannel.find({
      type: "federation",
      federationId: req.params.federationId,
    })
      .populate("createdBy", "username fotoPerfil")
      .populate("activeUsers", "username fotoPerfil");
    res.json({ success: true, federationVoiceChannels });
  } catch (err) {
    serverError(res, err);
  }
});

/**
 * @swagger
 * /api/voice-channels/{id}/join:
 *   put:
 *     summary: Entrar em um canal de voz
 *     tags: [Canais de Voz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do canal de voz
 *     responses:
 *       200:
 *         description: Entrou no canal de voz com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 voiceChannel:
 *                   $ref: '#/components/schemas/VoiceChannel'
 *       400:
 *         description: Usuário já está no canal de voz ou canal lotado
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Canal de voz não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/join", protect, async (req, res) => {
  try {
    const voiceChannel = await VoiceChannel.findById(req.params.id);

    if (!voiceChannel) {
      return res.status(404).json({ error: "Canal de voz não encontrado." });
    }
    if (voiceChannel.activeUsers.includes(req.user.id)) {
      return res.status(400).json({ error: "Usuário já está neste canal de voz." });
    }
    if (voiceChannel.activeUsers.length >= voiceChannel.userLimit) {
      return res.status(400).json({ error: "Canal de voz está lotado." });
    }

    voiceChannel.activeUsers.push(req.user.id);
    await voiceChannel.save();

    const updatedVoiceChannel = await VoiceChannel.findById(req.params.id)
      .populate("createdBy", "username fotoPerfil")
      .populate("activeUsers", "username fotoPerfil");

    res.json({ success: true, voiceChannel: updatedVoiceChannel });
  } catch (err) {
    serverError(res, err);
  }
});

/**
 * @swagger
 * /api/voice-channels/{id}/leave:
 *   put:
 *     summary: Sair de um canal de voz
 *     tags: [Canais de Voz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do canal de voz
 *     responses:
 *       200:
 *         description: Saiu do canal de voz com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 voiceChannel:
 *                   $ref: '#/components/schemas/VoiceChannel'
 *       400:
 *         description: Usuário não está no canal de voz
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Canal de voz não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/leave", protect, async (req, res) => {
  try {
    const voiceChannel = await VoiceChannel.findById(req.params.id);

    if (!voiceChannel) {
      return res.status(404).json({ error: "Canal de voz não encontrado." });
    }
    if (!voiceChannel.activeUsers.includes(req.user.id)) {
      return res.status(400).json({ error: "Usuário não está neste canal de voz." });
    }

    voiceChannel.activeUsers = voiceChannel.activeUsers.filter(
      (userId) => userId.toString() !== req.user.id
    );
    await voiceChannel.save();

    const updatedVoiceChannel = await VoiceChannel.findById(req.params.id)
      .populate("createdBy", "username fotoPerfil")
      .populate("activeUsers", "username fotoPerfil");

    res.json({ success: true, voiceChannel: updatedVoiceChannel });
  } catch (err) {
    serverError(res, err);
  }
});

/**
 * @swagger
 * /api/voice-channels/{id}:
 *   delete:
 *     summary: Deletar um canal de voz
 *     tags: [Canais de Voz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do canal de voz
 *     responses:
 *       200:
 *         description: Canal de voz removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não é o criador do canal ou não é ADM
 *       404:
 *         description: Canal de voz não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.delete("/:id", protect, async (req, res) => {
  try {
    const voiceChannel = await VoiceChannel.findById(req.params.id);

    if (!voiceChannel) {
      return res.status(404).json({ error: "Canal de voz não encontrado." });
    }

    // Só ADM ou criador pode deletar
    if (voiceChannel.createdBy.toString() !== req.user.id && req.user.role !== "ROLE_ADM") {
      return res.status(403).json({ error: "Não autorizado a deletar este canal." });
    }

    await voiceChannel.remove();
    res.json({ success: true, message: "Canal de voz removido." });
  } catch (err) {
    serverError(res, err);
  }
});

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     VoiceChannel:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único do canal de voz
 *         name:
 *           type: string
 *           description: Nome do canal de voz
 *         description:
 *           type: string
 *           description: Descrição do canal de voz
 *           nullable: true
 *         type:
 *           type: string
 *           enum: [global, clan, federation]
 *           description: Tipo do canal de voz
 *         clanId:
 *           type: string
 *           description: ID do clã associado (se type for 'clan')
 *           nullable: true
 *         federationId:
 *           type: string
 *           description: ID da federação associada (se type for 'federation')
 *           nullable: true
 *         userLimit:
 *           type: number
 *           description: Limite de usuários no canal de voz
 *         createdBy:
 *           type: string
 *           description: ID do usuário que criou o canal
 *         activeUsers:
 *           type: array
 *           items:
 *             type: string
 *           description: IDs dos usuários atualmente no canal de voz
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data de criação do canal
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização do canal
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d1a"
 *         name: "Sala de Voz Geral"
 *         description: "Canal de voz para comunicação geral"
 *         type: "global"
 *         userLimit: 20
 *         createdBy: "60d5ec49f8c7b7001c8e4d1b"
 *         activeUsers: []
 *         createdAt: "2023-10-27T10:00:00Z"
 *         updatedAt: "2023-10-27T10:00:00Z"
 */


