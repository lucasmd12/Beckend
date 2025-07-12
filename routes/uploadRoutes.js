const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const uploadController = require("../controllers/uploadController");

/**
 * @swagger
 * tags:
 *   name: Uploads
 *   description: Gerenciamento de uploads de arquivos e identidades visuais
 */

/**
 * @swagger
 * /api/upload/profile-picture:
 *   post:
 *     summary: Upload da foto de perfil do usuário
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo de imagem para a foto de perfil
 *     responses:
 *       200:
 *         description: Foto de perfil enviada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 imageUrl:
 *                   type: string
 *       400:
 *         description: Erro na requisição ou arquivo inválido
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/profile-picture", auth, uploadController.uploadProfilePicture);

/**
 * @swagger
 * /api/upload/clan-flag/{clanId}:
 *   post:
 *     summary: Upload da bandeira do clã
 *     tags: [Uploads]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               clanFlag:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo de imagem para a bandeira do clã
 *     responses:
 *       200:
 *         description: Bandeira do clã enviada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 imageUrl:
 *                   type: string
 *       400:
 *         description: Erro na requisição ou arquivo inválido
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não é líder do clã
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/clan-flag/:clanId", auth, uploadController.uploadClanFlag);

/**
 * @swagger
 * /api/upload/federation-tag/{federationId}:
 *   put:
 *     summary: Atualizar a TAG da federação
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: federationId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               federationTag:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo de imagem para a TAG da federação
 *     responses:
 *       200:
 *         description: TAG da federação atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 imageUrl:
 *                   type: string
 *       400:
 *         description: Erro na requisição ou arquivo inválido
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não é ADM ou líder da federação
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.put("/federation-tag/:federationId", auth, uploadController.updateFederationTag);

/**
 * @swagger
 * /api/upload/user-identity/{userId}:
 *   get:
 *     summary: Obter informações de identidade visual do usuário
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Informações de identidade visual do usuário
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
 *                     profilePictureUrl:
 *                       type: string
 *                     clanFlagUrl:
 *                       type: string
 *                     federationTagUrl:
 *                       type: string
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/user-identity/:userId", auth, uploadController.getUserIdentity);

/**
 * @swagger
 * /api/upload/clan-flags:
 *   get:
 *     summary: Listar todas as bandeiras de clãs
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de bandeiras de clãs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       clanId:
 *                         type: string
 *                       clanName:
 *                         type: string
 *                       flagUrl:
 *                         type: string
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/clan-flags", auth, uploadController.getAllClanFlags);

/**
 * @swagger
 * /api/upload/federation-tags:
 *   get:
 *     summary: Listar todas as TAGs de federações
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de TAGs de federações
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       federationId:
 *                         type: string
 *                       federationName:
 *                         type: string
 *                       tagUrl:
 *                         type: string
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/federation-tags", auth, uploadController.getAllFederationTags);

module.exports = router;


