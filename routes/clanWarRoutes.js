const express = require("express");
const router = express.Router();
const clanWarController = require("../controllers/clanWarController");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Guerra de Clãs
 *   description: Gerenciamento de guerras entre clãs
 */

/**
 * @swagger
 * /api/clan-wars/declare:
 *   post:
 *     summary: Declarar guerra a outro clã
 *     tags: [Guerra de Clãs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - challengedClanId
 *             properties:
 *               challengedClanId:
 *                 type: string
 *                 description: ID do clã a ser desafiado
 *               rules:
 *                 type: string
 *                 description: Regras específicas para esta guerra (opcional)
 *     responses:
 *       201:
 *         description: Guerra declarada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 war:
 *                   $ref: '#/components/schemas/ClanWar'
 *       400:
 *         description: Requisição inválida ou clã já em guerra
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Apenas líderes ou sublíderes podem declarar guerra
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/declare", protect, clanWarController.declareWar);

/**
 * @swagger
 * /api/clan-wars:
 *   get:
 *     summary: Obter todas as guerras de clãs
 *     tags: [Guerra de Clãs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de todas as guerras de clãs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 wars:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ClanWar'
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/", protect, clanWarController.getAllClanWars);

/**
 * @swagger
 * /api/clan-wars/{warId}/accept:
 *   post:
 *     summary: Aceitar um desafio de guerra
 *     tags: [Guerra de Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: warId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da guerra a ser aceita
 *     responses:
 *       200:
 *         description: Guerra aceita com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 war:
 *                   $ref: '#/components/schemas/ClanWar'
 *       400:
 *         description: Guerra não está pendente
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Não é o clã desafiado ou permissão insuficiente
 *       404:
 *         description: Guerra não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/:warId/accept", protect, clanWarController.acceptWar);

/**
 * @swagger
 * /api/clan-wars/{warId}/reject:
 *   post:
 *     summary: Rejeitar um desafio de guerra
 *     tags: [Guerra de Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: warId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da guerra a ser rejeitada
 *     responses:
 *       200:
 *         description: Guerra rejeitada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 war:
 *                   $ref: '#/components/schemas/ClanWar'
 *       400:
 *         description: Guerra não está pendente
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Não é o clã desafiado ou permissão insuficiente
 *       404:
 *         description: Guerra não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/:warId/reject", protect, clanWarController.rejectWar);

/**
 * @swagger
 * /api/clan-wars/{warId}/report-result:
 *   post:
 *     summary: Reportar o resultado de uma guerra
 *     tags: [Guerra de Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: warId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da guerra
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - winnerClanId
 *               - challengerScore
 *               - challengedScore
 *             properties:
 *               winnerClanId:
 *                 type: string
 *                 description: ID do clã vencedor
 *               challengerScore:
 *                 type: number
 *                 description: Pontuação do clã desafiante
 *               challengedScore:
 *                 type: number
 *                 description: Pontuação do clã desafiado
 *               evidence:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: URLs de evidências (imagens/vídeos) do resultado
 *     responses:
 *       200:
 *         description: Resultado da guerra reportado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 war:
 *                   $ref: '#/components/schemas/ClanWar'
 *       400:
 *         description: Requisição inválida ou guerra não está ativa
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Permissão insuficiente
 *       404:
 *         description: Guerra não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/:warId/report-result", protect, clanWarController.reportWarResult);

/**
 * @swagger
 * /api/clan-wars/{warId}/cancel:
 *   post:
 *     summary: Cancelar uma guerra de clãs
 *     tags: [Guerra de Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: warId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da guerra a ser cancelada
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Motivo do cancelamento (opcional)
 *     responses:
 *       200:
 *         description: Guerra cancelada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 war:
 *                   $ref: '#/components/schemas/ClanWar'
 *       400:
 *         description: Guerra não pode ser cancelada neste status
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Permissão insuficiente
 *       404:
 *         description: Guerra não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/:warId/cancel", protect, clanWarController.cancelWar);

/**
 * @swagger
 * /api/clan-wars/active:
 *   get:
 *     summary: Obter todas as guerras ativas
 *     tags: [Guerra de Clãs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de guerras ativas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 wars:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ClanWar'
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/active", protect, clanWarController.getActiveWars);

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     ClanWar:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único da guerra
 *         challengerClan:
 *           type: string
 *           description: ID do clã desafiante
 *         challengedClan:
 *           type: string
 *           description: ID do clã desafiado
 *         status:
 *           type: string
 *           enum: [pending, accepted, rejected, active, completed, cancelled]
 *           description: Status atual da guerra
 *         declaredAt:
 *           type: string
 *           format: date-time
 *           description: Data e hora da declaração da guerra
 *         startedAt:
 *           type: string
 *           format: date-time
 *           description: Data e hora de início da guerra (se aceita)
 *         endedAt:
 *           type: string
 *           format: date-time
 *           description: Data e hora de término da guerra (se concluída/cancelada)
 *         winnerClan:
 *           type: string
 *           description: ID do clã vencedor (se concluída)
 *           nullable: true
 *         loserClan:
 *           type: string
 *           description: ID do clã perdedor (se concluída)
 *           nullable: true
 *         score:
 *           type: object
 *           properties:
 *             challenger:
 *               type: number
 *             challenged:
 *               type: number
 *           description: Pontuação final da guerra
 *         rules:
 *           type: string
 *           description: Regras específicas da guerra
 *           nullable: true
 *         evidence:
 *           type: array
 *           items:
 *             type: string
 *           description: URLs de evidências do resultado (imagens/vídeos)
 *         declaredBy:
 *           type: string
 *           description: ID do usuário que declarou a guerra
 *         respondedBy:
 *           type: string
 *           description: ID do usuário que aceitou/rejeitou a guerra
 *           nullable: true
 *         reportedBy:
 *           type: string
 *           description: ID do usuário que reportou o resultado/cancelou a guerra
 *           nullable: true
 *         cancellationReason:
 *           type: string
 *           description: Motivo do cancelamento (se cancelada)
 *           nullable: true
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização da guerra
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d25"
 *         challengerClan: "60d5ec49f8c7b7001c8e4d1a"
 *         challengedClan: "60d5ec49f8c7b7001c8e4d1b"
 *         status: "pending"
 *         declaredAt: "2023-10-27T10:30:00Z"
 *         startedAt: null
 *         endedAt: null
 *         winnerClan: null
 *         loserClan: null
 *         score:
 *           challenger: 0
 *           challenged: 0
 *         rules: "Primeiro clã a atingir 100 abates vence."
 *         evidence: []
 *         declaredBy: "60d5ec49f8c7b7001c8e4d1c"
 *         respondedBy: null
 *         reportedBy: null
 *         cancellationReason: null
 *         updatedAt: "2023-10-27T10:30:00Z"
 */


