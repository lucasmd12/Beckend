const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { createInstaClanPost, getInstaClanPosts, deleteInstaClanPost } = require("../controllers/instaclanController");

/**
 * @swagger
 * tags:
 *   name: Insta Clã
 *   description: Gerenciamento de postagens do Insta Clã
 */

/**
 * @swagger
 * /api/clans/{clanId}/instaclan/posts:
 *   post:
 *     summary: Criar uma nova postagem no Insta Clã
 *     tags: [Insta Clã]
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
 *                 description: Conteúdo da postagem
 *               imageUrl:
 *                 type: string
 *                 description: URL da imagem (opcional)
 *     responses:
 *       201:
 *         description: Postagem criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InstaClanPost'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/:clanId/instaclan/posts", protect, createInstaClanPost);

/**
 * @swagger
 * /api/clans/{clanId}/instaclan/posts:
 *   get:
 *     summary: Listar postagens do Insta Clã de um clã específico
 *     tags: [Insta Clã]
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
 *         description: Lista de postagens
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/InstaClanPost'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/:clanId/instaclan/posts", protect, getInstaClanPosts);

/**
 * @swagger
 * /api/clans/{clanId}/instaclan/posts/{postId}:
 *   delete:
 *     summary: Excluir uma postagem do Insta Clã
 *     tags: [Insta Clã]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clanId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: postId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da postagem
 *     responses:
 *       200:
 *         description: Postagem excluída com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Postagem ou clã não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.delete("/:clanId/instaclan/posts/:postId", protect, deleteInstaClanPost);

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     InstaClanPost:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único da postagem
 *         clan:
 *           type: string
 *           description: ID do clã ao qual a postagem pertence
 *         author:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             username:
 *               type: string
 *             avatar:
 *               type: string
 *           description: Informações do autor da postagem
 *         content:
 *           type: string
 *           description: Conteúdo da postagem
 *         imageUrl:
 *           type: string
 *           description: URL da imagem anexada (opcional)
 *         likes:
 *           type: array
 *           items:
 *             type: string
 *           description: IDs dos usuários que curtiram a postagem
 *         comments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               author:
 *                 type: string
 *               content:
 *                 type: string
 *               createdAt:
 *                 type: string
 *                 format: date-time
 *           description: Comentários na postagem
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data de criação da postagem
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização da postagem
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d1a"
 *         clan: "60d5ec49f8c7b7001c8e4d1b"
 *         author:
 *           _id: "60d5ec49f8c7b7001c8e4d1c"
 *           username: "UserExample"
 *           avatar: "https://example.com/avatar.png"
 *         content: "Primeira postagem no Insta Clã!"
 *         imageUrl: "https://example.com/image.jpg"
 *         likes: ["60d5ec49f8c7b7001c8e4d1d"]
 *         comments: []
 *         createdAt: "2023-10-27T10:00:00Z"
 *         updatedAt: "2023-10-27T10:00:00Z"
 */


