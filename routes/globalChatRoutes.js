const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const globalChatController = require("../controllers/globalChatController");

/**
 * @swagger
 * tags:
 *   name: Chat Global
 *   description: Gerenciamento de mensagens de chat global
 */

/**
 * @swagger
 * /api/global-chat/message:
 *   post:
 *     summary: Enviar uma mensagem para o chat global
 *     tags: [Chat Global]
 *     security:
 *       - bearerAuth: []
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
 *               type:
 *                 type: string
 *                 description: "Tipo da mensagem (ex: text, image, file)"
 *                 enum: [text, image, file]
 *                 default: text
 *               fileUrl:
 *                 type: string
 *                 description: URL do arquivo, se o tipo for image ou file
 *                 nullable: true
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
 *                   $ref: '#/components/schemas/GlobalChatMessage'
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro no servidor
 */
router.post("/message", protect, globalChatController.sendMessage);

/**
 * @swagger
 * /api/global-chat/messages:
 *   get:
 *     summary: Obter mensagens do chat global
 *     tags: [Chat Global]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Lista de mensagens do chat global
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
 *                     $ref: '#/components/schemas/GlobalChatMessage'
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro no servidor
 */
router.get("/messages", protect, globalChatController.getMessages);

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     GlobalChatMessage:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único da mensagem
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
 *         sender: "60d5ec49f8c7b7001c8e4d1b"
 *         content: "Olá a todos no chat global!"
 *         timestamp: "2023-10-27T10:00:00Z"
 */


