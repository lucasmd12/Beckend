const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const Clan = require("../models/Clan");
const Federation = require("../models/Federation");

/**
 * @swagger
 * tags:
 *   name: Convites
 *   description: Gerenciamento de convites para clãs e federações
 */

/**
 * @swagger
 * /api/invites:
 *   post:
 *     summary: Enviar convite para um usuário
 *     tags: [Convites]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - type
 *               - targetId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID do usuário a ser convidado
 *               type:
 *                 type: string
 *                 enum: [clan, federation]
 *                 description: Tipo de convite (clã ou federação)
 *               targetId:
 *                 type: string
 *                 description: ID do clã ou federação para o qual o convite é enviado
 *     responses:
 *       200:
 *         description: Convite enviado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 invite:
 *                   $ref: "#/components/schemas/Invite"
 *       400:
 *         description: "Erro na requisição (ex: dados inválidos)"
 */
router.post("/", auth, async (req, res) => {
  try {
    const { userId, type, targetId } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    let target;
    if (type === "clan") {
      target = await Clan.findById(targetId);
    } else if (type === "federation") {
      target = await Federation.findById(targetId);
    }

    if (!target) {
      return res.status(404).json({ message: `${type} não encontrado` });
    }

    res.json({ 
      message: "Convite enviado com sucesso",
      invite: {
        userId,
        type,
        targetId,
        status: "pending",
        createdAt: new Date()
      }
    });

  } catch (error) {
    console.error("Erro ao enviar convite:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

/**
 * @swagger
 * /api/invites:
 *   get:
 *     summary: Listar convites do usuário logado
 *     tags: [Convites]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de convites
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invites:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/Invite"
 *                 message:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/", auth, async (req, res) => {
  try {
    res.json({ 
      invites: [],
      message: "Lista de convites carregada"
    });
  } catch (error) {
    console.error("Erro ao listar convites:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

/**
 * @swagger
 * /api/invites/{id}/accept:
 *   post:
 *     summary: Aceitar um convite
 *     tags: [Convites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do convite a ser aceito
 *     responses:
 *       200:
 *         description: Convite aceito com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 inviteId:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Convite não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/:id/accept", auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    res.json({ 
      message: "Convite aceito com sucesso",
      inviteId: id
    });
  } catch (error) {
    console.error("Erro ao aceitar convite:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

/**
 * @swagger
 * /api/invites/{id}/reject:
 *   post:
 *     summary: Rejeitar um convite
 *     tags: [Convites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do convite a ser rejeitado
 *     responses:
 *       200:
 *         description: Convite rejeitado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 inviteId:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Convite não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/:id/reject", auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    res.json({ 
      message: "Convite rejeitado",
      inviteId: id
    });
  } catch (error) {
    console.error("Erro ao rejeitar convite:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     Invite:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único do convite
 *         userId:
 *           type: string
 *           description: ID do usuário convidado
 *         type:
 *           type: string
 *           enum: [clan, federation]
 *           description: Tipo de convite (clã ou federação)
 *         targetId:
 *           type: string
 *           description: ID do clã ou federação
 *         status:
 *           type: string
 *           enum: [pending, accepted, rejected]
 *           description: Status do convite
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data de criação do convite
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d1a"
 *         userId: "60d5ec49f8c7b7001c8e4d1b"
 *         type: "clan"
 *         targetId: "60d5ec49f8c7b7001c8e4d1c"
 *         status: "pending"
 *         createdAt: "2023-10-27T10:00:00Z"
 */


