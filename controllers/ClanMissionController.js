// controllers/ClanMissionController.js

const ClanMission = require("../models/ClanMission");

/**
 * @swagger
 * tags:
 *   name: Missões de Clã
 *   description: Gerenciamento de missões QRR para clãs
 */

/**
 * @swagger
 * /api/clan-missions:
 *   post:
 *     summary: Criar uma nova missão QRR
 *     tags: [Missões de Clã]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clanId
 *               - title
 *               - description
 *               - type
 *               - reward
 *             properties:
 *               clanId:
 *                 type: string
 *                 description: ID do clã ao qual a missão pertence
 *               title:
 *                 type: string
 *                 description: Título da missão
 *               description:
 *                 type: string
 *                 description: Descrição detalhada da missão
 *               type:
 *                 type: string
 *                 enum: [daily, weekly, special]
 *                 description: Tipo da missão (diária, semanal, especial)
 *               reward:
 *                 type: number
 *                 description: Recompensa da missão
 *               deadline:
 *                 type: string
 *                 format: date-time
 *                 description: Prazo final para a missão (opcional)
 *     responses:
 *       201:
 *         description: Missão criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ClanMission"
 *       400:
  *         description: "Erro na requisição (ex: dados inválidos)"
 *       401:
 *         description: Não autorizado
 *       500: */
exports.createMission = async (req, res) => {
  try {
    const mission = await ClanMission.create(req.body);
    res.status(201).json(mission);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * @swagger
 * /api/clan-missions/clan/{clanId}:
 *   get:
 *     summary: Listar missões de um clã específico
 *     tags: [Missões de Clã]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clanId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã para listar as missões
 *     responses:
 *       200:
 *         description: Lista de missões do clã
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/ClanMission"
 *       400:
 *         description: Erro na requisição
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
exports.listMissions = async (req, res) => {
  try {
    const { clanId } = req.params;
    const missions = await ClanMission.find({ clanId }).sort({ createdAt: -1 });
    res.json(missions);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * @swagger
 * /api/clan-missions/{id}:
 *   get:
 *     summary: Buscar missão por ID
 *     tags: [Missões de Clã]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da missão
 *     responses:
 *       200:
 *         description: Detalhes da missão
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ClanMission"
 *       400:
 *         description: Erro na requisição
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Missão não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
exports.getMission = async (req, res) => {
  try {
    const mission = await ClanMission.findById(req.params.id);
    if (!mission) return res.status(404).json({ error: "Missão não encontrada" });
    res.json(mission);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * @swagger
 * /api/clan-missions/{id}/confirm-presence:
 *   post:
 *     summary: Confirmar presença em uma missão
 *     tags: [Missões de Clã]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da missão
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID do usuário que confirma presença
 *     responses:
 *       200:
 *         description: Presença confirmada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ClanMission"
 *       400:
 *         description: Erro na requisição
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Missão não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
exports.confirmPresence = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const mission = await ClanMission.findByIdAndUpdate(
      id,
      { $addToSet: { confirmedMembers: userId } },
      { new: true }
    );
    res.json(mission);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * @swagger
 * /api/clan-missions/{id}/strategy-media:
 *   post:
 *     summary: Adicionar mídia de estratégia (upload de imagem)
 *     tags: [Missões de Clã]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da missão
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mediaUrl
 *             properties:
 *               mediaUrl:
 *                 type: string
 *                 description: URL da mídia de estratégia (imagem, vídeo, etc.)
 *     responses:
 *       200:
 *         description: Mídia de estratégia adicionada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ClanMission"
 *       400:
 *         description: Erro na requisição
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Missão não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
exports.addStrategyMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const { mediaUrl } = req.body;
    const mission = await ClanMission.findByIdAndUpdate(
      id,
      { $push: { strategyMediaUrls: mediaUrl } },
      { new: true }
    );
    res.json(mission);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * @swagger
 * /api/clan-missions/{id}/cancel:
 *   post:
 *     summary: Cancelar missão
 *     tags: [Missões de Clã]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da missão a ser cancelada
 *     responses:
 *       200:
 *         description: Missão cancelada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ClanMission"
 *       400:
 *         description: Erro na requisição
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Missão não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
exports.cancelMission = async (req, res) => {
  try {
    const { id } = req.params;
    const mission = await ClanMission.findByIdAndUpdate(
      id,
      { status: 'cancelled' },
      { new: true }
    );
    res.json(mission);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * @swagger
 * components:
 *   schemas:
 *     ClanMission:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único da missão
 *         clanId:
 *           type: string
 *           description: ID do clã ao qual a missão pertence
 *         title:
 *           type: string
 *           description: Título da missão
 *         description:
 *           type: string
 *           description: Descrição detalhada da missão
 *         type:
 *           type: string
 *           enum: [daily, weekly, special]
 *           description: Tipo da missão (diária, semanal, especial)
 *         reward:
 *           type: number
 *           description: Recompensa da missão
 *         deadline:
 *           type: string
 *           format: date-time
 *           description: Prazo final para a missão (opcional)
 *         status:
 *           type: string
 *           enum: [active, completed, cancelled]
 *           description: Status atual da missão
 *         confirmedMembers:
 *           type: array
 *           items:
 *             type: string
 *           description: IDs dos membros que confirmaram presença
 *         strategyMediaUrls:
 *           type: array
 *           items:
 *             type: string
 *           description: URLs de mídias de estratégia (imagens, vídeos)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data de criação da missão
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização da missão
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d1a"
 *         clanId: "60d5ec49f8c7b7001c8e4d1b"
 *         title: "Missão de Coleta de Recursos"
 *         description: "Coletar 500 unidades de madeira e 200 de pedra."
 *         type: "daily"
 *         reward: 100
 *         deadline: "2023-10-28T23:59:59Z"
 *         status: "active"
 *         confirmedMembers: []
 *         strategyMediaUrls: []
 *         createdAt: "2023-10-27T10:00:00Z"
 *         updatedAt: "2023-10-27T10:00:00Z"
 */


