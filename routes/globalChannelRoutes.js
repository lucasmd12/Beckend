const express = require("express");
const router = express.Router();
const GlobalChannel = require("../models/GlobalChannel");
const { protect } = require("../middleware/authMiddleware");
const { check, validationResult } = require("express-validator");

// Função padrão para erro de servidor
const serverError = (res, err) => {
  console.error(err.message);
  return res.status(500).json({ error: "Erro interno do servidor" });
};

/**
 * @swagger
 * tags:
 *   name: Canais Globais
 *   description: Gerenciamento de canais de texto e voz globais
 */

/**
 * @swagger
 * /api/global-channels:
 *   get:
 *     summary: Listar todos os canais globais (texto e voz)
 *     tags: [Canais Globais]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de canais globais
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 globalChannels:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/GlobalChannel"
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/", protect, async (req, res) => {
  try {
    const globalChannels = await GlobalChannel.find()
      .populate("createdBy", "username fotoPerfil")
      .populate("activeUsers", "username fotoPerfil");
    res.json({ success: true, globalChannels });
  } catch (err) {
    serverError(res, err);
  }
});

/**
 * @swagger
 * /api/global-channels/text:
 *   get:
 *     summary: Listar canais de texto globais
 *     tags: [Canais Globais]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de canais de texto globais
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 textChannels:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/GlobalChannel"
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/text", protect, async (req, res) => {
  try {
    const textChannels = await GlobalChannel.find({ type: "text" })
      .populate("createdBy", "username fotoPerfil");
    res.json({ success: true, textChannels });
  } catch (err) {
    serverError(res, err);
  }
});

/**
 * @swagger
 * /api/global-channels/voice:
 *   get:
 *     summary: Listar canais de voz globais
 *     tags: [Canais Globais]
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
 *                 voiceChannels:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/GlobalChannel"
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/voice", protect, async (req, res) => {
  try {
    const voiceChannels = await GlobalChannel.find({ type: "voice" })
      .populate("createdBy", "username fotoPerfil")
      .populate("activeUsers", "username fotoPerfil");
    res.json({ success: true, voiceChannels });
  } catch (err) {
    serverError(res, err);
  }
});

/**
 * @swagger
 * /api/global-channels:
 *   post:
 *     summary: Criar um novo canal global (apenas ADM)
 *     tags: [Canais Globais]
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
 *                 description: Nome do canal
 *               description:
 *                 type: string
 *                 description: Descrição do canal (opcional)
 *               type:
 *                 type: string
 *                 enum: [text, voice]
 *                 description: Tipo do canal (texto ou voz)
 *               userLimit:
 *                 type: number
 *                 description: Limite de usuários para canais de voz (opcional, padrão 15)
 *     responses:
 *       200:
 *         description: Canal global criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 globalChannel:
 *                   $ref: "#/components/schemas/GlobalChannel"
 *       400:
 *         description: Erro de validação ou dados inválidos
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Apenas ADM pode criar canais globais
 *       500:
 *         description: Erro interno do servidor
 */
router.post(
  "/",
  [
    protect,
    [
      check("name", "Nome é obrigatório").not().isEmpty(),
      check("type", "Tipo deve ser 'text' ou 'voice'").isIn(["text", "voice"]),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array() });
    }

    try {
      if (req.user.role !== "ADM") { // Alterado de ROLE_ADM para ADM
        return res.status(403).json({ error: "Apenas ADM pode criar canais globais." });
      }

      const { name, description, type, userLimit } = req.body;
      const newGlobalChannel = new GlobalChannel({
        name,
        description,
        type,
        userLimit: type === "voice" ? (userLimit || 15) : undefined,
        createdBy: req.user.id,
      });

      const globalChannel = await newGlobalChannel.save();
      res.json({ success: true, globalChannel });
    } catch (err) {
      serverError(res, err);
    }
  }
);

/**
 * @swagger
 * /api/global-channels/{id}/join:
 *   put:
 *     summary: Entrar em um canal de voz global
 *     tags: [Canais Globais]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do canal de voz global
 *     responses:
 *       200:
 *         description: Usuário entrou no canal de voz com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 globalChannel:
 *                   $ref: "#/components/schemas/GlobalChannel"
 *       400:
 *         description: "Erro na requisição (ex: canal não é de voz, usuário já está no canal, canal lotado)"
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Canal global não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.put("/:id/join", protect, async (req, res) => {
  try {
    const globalChannel = await GlobalChannel.findById(req.params.id);

    if (!globalChannel) {
      return res.status(404).json({ error: "Canal global não encontrado." });
    }
    if (globalChannel.type !== "voice") {
      return res.status(400).json({ error: "Apenas canais de voz podem ser acessados." });
    }
    if (globalChannel.activeUsers.includes(req.user.id)) {
      return res.status(400).json({ error: "Usuário já está neste canal de voz." });
    }
    if (globalChannel.activeUsers.length >= globalChannel.userLimit) {
      return res.status(400).json({ error: "Canal de voz está lotado." });
    }

    globalChannel.activeUsers.push(req.user.id);
    await globalChannel.save();

    const updatedGlobalChannel = await GlobalChannel.findById(req.params.id)
      .populate("createdBy", "username fotoPerfil")
      .populate("activeUsers", "username fotoPerfil");

    res.json({ success: true, globalChannel: updatedGlobalChannel });
  } catch (err) {
    serverError(res, err);
  }
});

/**
 * @swagger
 * /api/global-channels/{id}/leave:
 *   put:
 *     summary: Sair de um canal de voz global
 *     tags: [Canais Globais]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do canal de voz global
 *     responses:
 *       200:
 *         description: Usuário saiu do canal de voz com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 globalChannel:
 *                   $ref: "#/components/schemas/GlobalChannel"
 *       400:
 *         description: "Erro na requisição (ex: canal não é de voz, usuário não está no canal)"
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Canal global não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.put("/:id/leave", protect, async (req, res) => {
  try {
    const globalChannel = await GlobalChannel.findById(req.params.id);

    if (!globalChannel) {
      return res.status(404).json({ error: "Canal global não encontrado." });
    }
    if (globalChannel.type !== "voice") {
      return res.status(400).json({ error: "Apenas canais de voz podem ser acessados." });
    }
    if (!globalChannel.activeUsers.includes(req.user.id)) {
      return res.status(400).json({ error: "Usuário não está neste canal de voz." });
    }

    globalChannel.activeUsers = globalChannel.activeUsers.filter(
      (userId) => userId.toString() !== req.user.id
    );
    await globalChannel.save();

    const updatedGlobalChannel = await GlobalChannel.findById(req.params.id)
      .populate("createdBy", "username fotoPerfil")
      .populate("activeUsers", "username fotoPerfil");

    res.json({ success: true, globalChannel: updatedGlobalChannel });
  } catch (err) {
    serverError(res, err);
  }
});

/**
 * @swagger
 * /api/global-channels/{id}:
 *   delete:
 *     summary: Deletar um canal global (apenas ADM)
 *     tags: [Canais Globais]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do canal global a ser deletado
 *     responses:
 *       200:
 *         description: Canal global removido com sucesso
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
 *         description: Apenas ADM pode deletar canais globais
 *       404:
 *         description: Canal global não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.delete("/:id", protect, async (req, res) => {
  try {
    const globalChannel = await GlobalChannel.findById(req.params.id);

    if (!globalChannel) {
      return res.status(404).json({ error: "Canal global não encontrado." });
    }
    if (req.user.role !== "ADM") { // Alterado de ROLE_ADM para ADM
      return res.status(403).json({ error: "Apenas ADM pode deletar canais globais." });
    }

    await globalChannel.remove();
    res.json({ success: true, message: "Canal global removido." });
  } catch (err) {
    serverError(res, err);
  }
});

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     GlobalChannel:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único do canal global
 *         name:
 *           type: string
 *           description: Nome do canal
 *         description:
 *           type: string
 *           description: Descrição do canal
 *         type:
 *           type: string
 *           enum: [text, voice]
 *           description: Tipo do canal (texto ou voz)
 *         userLimit:
 *           type: number
 *           description: Limite de usuários para canais de voz
 *         createdBy:
 *           type: string
 *           description: ID do usuário que criou o canal
 *         activeUsers:
 *           type: array
 *           items:
 *             type: string
 *           description: IDs dos usuários ativos no canal de voz
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
 *         name: "Canal Geral"
 *         description: "Canal de texto para discussões gerais."
 *         type: "text"
 *         createdBy: "60d5ec49f8c7b7001c8e4d1b"
 *         activeUsers: []
 *         createdAt: "2023-10-27T10:00:00Z"
 *         updatedAt: "2023-10-27T10:00:00Z"
 */


