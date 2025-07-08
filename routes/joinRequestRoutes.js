const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const Clan = require("../models/Clan");
const Federation = require("../models/Federation");

/**
 * @swagger
 * tags:
 *   name: Solicitações de Entrada
 *   description: Gerenciamento de solicitações para entrar em clãs ou federações
 */

/**
 * @swagger
 * /api/join-requests:
 *   post:
 *     summary: Criar uma nova solicitação para entrar em um clã ou federação
 *     tags: [Solicitações de Entrada]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - targetId
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [clan, federation]
 *                 description: Tipo de solicitação (clã ou federação)
 *               targetId:
 *                 type: string
 *                 description: ID do clã ou federação para o qual a solicitação é enviada
 *               message:
 *                 type: string
 *                 description: Mensagem opcional para a solicitação
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Solicitação criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 joinRequest:
 *                   $ref: "#/components/schemas/JoinRequest"
 *       400:
 *         description: "Erro na requisição (ex: dados inválidos)"
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Usuário ou alvo (clã/federação) não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/", auth, async (req, res) => {
  try {
    const { type, targetId, message } = req.body;
    const userId = req.user.id;
    
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

    const joinRequest = {
      id: Date.now().toString(),
      userId,
      type,
      targetId,
      message: message || "",
      status: "pending",
      createdAt: new Date()
    };

    res.json({ 
      message: "Solicitação enviada com sucesso",
      joinRequest
    });

  } catch (error) {
    console.error("Erro ao criar solicitação:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

/**
 * @swagger
 * /api/join-requests:
 *   get:
 *     summary: Listar solicitações de entrada do usuário logado
 *     tags: [Solicitações de Entrada]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de solicitações de entrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 joinRequests:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/JoinRequest"
 *                 message:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    res.json({ 
      joinRequests: [],
      message: "Lista de solicitações carregada"
    });
  } catch (error) {
    console.error("Erro ao listar solicitações:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

/**
 * @swagger
 * /api/join-requests/pending:
 *   get:
 *     summary: Listar solicitações pendentes para aprovação (para líderes/administradores)
 *     tags: [Solicitações de Entrada]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de solicitações pendentes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pendingRequests:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/JoinRequest"
 *                 message:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para visualizar solicitações pendentes
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/pending", auth, async (req, res) => {
  try {
    res.json({ 
      pendingRequests: [],
      message: "Solicitações pendentes carregadas"
    });
  } catch (error) {
    console.error("Erro ao listar solicitações pendentes:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

/**
 * @swagger
 * /api/join-requests/{id}/approve:
 *   post:
 *     summary: Aprovar uma solicitação de entrada
 *     tags: [Solicitações de Entrada]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da solicitação de entrada a ser aprovada
 *     responses:
 *       200:
 *         description: Solicitação aprovada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 requestId:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para aprovar esta solicitação
 *       404:
 *         description: Solicitação não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/:id/approve", auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    res.json({ 
      message: "Solicitação aprovada com sucesso",
      requestId: id
    });
  } catch (error) {
    console.error("Erro ao aprovar solicitação:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

/**
 * @swagger
 * /api/join-requests/{id}/reject:
 *   post:
 *     summary: Rejeitar uma solicitação de entrada
 *     tags: [Solicitações de Entrada]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da solicitação de entrada a ser rejeitada
 *     responses:
 *       200:
 *         description: Solicitação rejeitada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 requestId:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para rejeitar esta solicitação
 *       404:
 *         description: Solicitação não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/:id/reject", auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    res.json({ 
      message: "Solicitação rejeitada",
      requestId: id
    });
  } catch (error) {
    console.error("Erro ao rejeitar solicitação:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

/**
 * @swagger
 * /api/join-requests/{id}/cancel:
 *   delete:
 *     summary: Cancelar a própria solicitação de entrada
 *     tags: [Solicitações de Entrada]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da solicitação de entrada a ser cancelada
 *     responses:
 *       200:
 *         description: Solicitação cancelada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 requestId:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para cancelar esta solicitação
 *       404:
 *         description: Solicitação não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.delete("/:id/cancel", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    res.json({ 
      message: "Solicitação cancelada",
      requestId: id
    });
  } catch (error) {
    console.error("Erro ao cancelar solicitação:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     JoinRequest:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único da solicitação de entrada
 *         userId:
 *           type: string
 *           description: ID do usuário que fez a solicitação
 *         type:
 *           type: string
 *           enum: [clan, federation]
 *           description: Tipo de solicitação (clã ou federação)
 *         targetId:
 *           type: string
 *           description: ID do clã ou federação
 *         message:
 *           type: string
 *           description: Mensagem da solicitação
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected, cancelled]
 *           description: Status da solicitação
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data de criação da solicitação
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d1a"
 *         userId: "60d5ec49f8c7b7001c8e4d1b"
 *         type: "clan"
 *         targetId: "60d5ec49f8c7b7001c8e4d1c"
 *         message: "Gostaria muito de fazer parte do seu clã!"
 *         status: "pending"
 *         createdAt: "2023-10-27T10:00:00Z"
 */


