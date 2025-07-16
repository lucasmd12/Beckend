const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const clanChatController = require("../controllers/clanChatController");

/**
 * @swagger
 * tags:
 *   name: Chat do Clã
 *   description: Gerenciamento de mensagens de chat dentro de clãs
 */

/**
 * @swagger
 * /api/clan-chat/{clanId}/message:
 *   post:
 *     summary: Enviar uma mensagem para o chat do clã
 *     tags: [Chat do Clã]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clanId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
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
 *                   $ref: '#/components/schemas/ClanChatMessage'
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não é membro do clã
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.post("/:clanId/message", protect, clanChatController.sendMessage);

/**
 * @swagger
 * /api/clan-chat/{clanId}/messages:
 *   get:
 *     summary: Obter mensagens do chat de um clã
 *     tags: [Chat do Clã]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clanId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
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
 *         description: Lista de mensagens do chat do clã
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
 *                     $ref: '#/components/schemas/ClanChatMessage'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não é membro do clã
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.get("/:clanId/messages", protect, clanChatController.getMessages);

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     ClanChatMessage:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único da mensagem
 *         clan:
 *           type: string
 *           description: ID do clã ao qual a mensagem pertence
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
 *         clan: "60d5ec49f8c7b7001c8e4d1b"
 *         sender: "60d5ec49f8c7b7001c8e4d1c"
 *         content: "Olá a todos no clã!"
 *         timestamp: "2023-10-27T10:00:00Z"
 */


