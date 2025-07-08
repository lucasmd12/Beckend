const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const federationChatController = require("../controllers/federationChatController");

/**
 * @swagger
 * tags:
 *   name: Chat de Federação
 *   description: Gerenciamento de mensagens de chat dentro de federações
 */

/**
 * @swagger
 * /api/federation-chat/{federationId}/message:
 *   post:
 *     summary: Enviar uma mensagem para o chat de uma federação
 *     tags: [Chat de Federação]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: federationId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação para a qual a mensagem será enviada
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Conteúdo da mensagem
 *     responses:
 *       200:
 *         description: Mensagem enviada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/FederationChatMessage'
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não é membro da federação
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */
router.post("/:federationId/message", protect, federationChatController.sendMessage);

/**
 * @swagger
 * /api/federation-chat/{federationId}/messages:
 *   get:
 *     summary: Obter mensagens do chat de uma federação
 *     tags: [Chat de Federação]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: federationId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação para obter as mensagens
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página para paginação
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Limite de mensagens por página
 *     responses:
 *       200:
 *         description: Lista de mensagens do chat da federação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pages:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FederationChatMessage'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não é membro da federação
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */
router.get("/:federationId/messages", protect, federationChatController.getMessages);

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     FederationChatMessage:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único da mensagem
 *         federation:
 *           type: string
 *           description: ID da federação à qual a mensagem pertence
 *         sender:
 *           type: string
 *           description: ID do remetente da mensagem
 *         content:
 *           type: string
 *           description: Conteúdo da mensagem
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Data e hora do envio da mensagem
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d1a"
 *         federation: "60d5ec49f8c7b7001c8e4d1b"
 *         sender: "60d5ec49f8c7b7001c8e4d1c"
 *         content: "Olá a todos na federação!"
 *         timestamp: "2023-10-27T10:00:00Z"
 */


