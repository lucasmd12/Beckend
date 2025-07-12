const express = require("express");
const router = express.Router();
const qrrController = require("../controllers/qrrController");
const federationQRRController = require("../controllers/federationQRRController");
const { protect } = require("../middleware/authMiddleware");
const { check, validationResult } = require("express-validator");
const QRR = require("../models/QRR");
const Clan = require("../models/Clan");

/**
 * @swagger
 * tags:
 *   name: QRR
 *   description: Gerenciamento de Quests, Raids e Recompensas (QRR)
 */

// Middleware para verificar se é ADM, líder do clã ou criador do QRR
const checkQRRPermission = async (req, res, next) => {
  const qrrId = req.params.id;
  if (!qrrId) {
    return res.status(400).json({ msg: "ID do QRR é obrigatório." });
  }

  try {
    const qrr = await QRR.findById(qrrId);
    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }

    const isCreator = qrr.createdBy.toString() === req.user.id;
    const clan = await Clan.findById(qrr.clan);
    const isLeader = clan && clan.leader.toString() === req.user.id;
    const isAdmin = req.user.role === "ADM";

    if (isCreator || isLeader || isAdmin) {
      req.qrr = qrr; // Anexa o QRR ao objeto de requisição
      next();
    } else {
      res.status(403).json({ msg: "Acesso negado. Permissão insuficiente." });
    }
  } catch (error) {
    console.error("Erro no middleware checkQRRPermission:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/qrrs:
 *   post:
 *     summary: Criar um novo QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - clanId
 *               - startTime
 *               - endTime
 *             properties:
 *               title:
 *                 type: string
 *                 description: "Título do QRR"
 *               description:
 *                 type: string
 *                 description: "Descrição do QRR"
 *               clanId:
 *                 type: string
 *                 description: "ID do clã ao qual o QRR pertence"
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: "Hora de início do QRR (ISO 8601)"
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: "Hora de término do QRR (ISO 8601)"
 *     responses:
 *       201:
 *         description: QRR criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/QRR'
 *       400:
 *         description: Erro de validação
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para criar QRR para este clã
 *       500:
 *         description: Erro no servidor
 */
router.post(
  "/",
  protect,
  [
    check("title", "Título é obrigatório").not().isEmpty(),
    check("description", "Descrição é obrigatória").not().isEmpty(),
    check("clanId", "ID do clã é obrigatório").not().isEmpty(),
    check("startTime", "Hora de início é obrigatória").isISO8601(),
    check("endTime", "Hora de término é obrigatória").isISO8601(),
  ],
  qrrController.createQRR
);

/**
 * @swagger
 * /api/qrrs/clan/{clanId}:
 *   get:
 *     summary: Obter todos os QRRs para um clã específico
 *     tags: [QRR]
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
 *         description: Lista de QRRs do clã
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
 *                     $ref: '#/components/schemas/QRR'
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.get("/clan/:clanId", protect, qrrController.getQRRsByClan);

/**
 * @swagger
 * /api/qrrs/available/{clanId}:
 *   get:
 *     summary: Obter QRRs disponíveis para um clã (incluindo QRRs de federação)
 *     tags: [QRR]
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
 *         description: Lista de QRRs disponíveis
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
 *                     $ref: '#/components/schemas/QRR'
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.get("/available/:clanId", protect, federationQRRController.getAvailableQRRsForClan);

/**
 * @swagger
 * /api/qrrs/{id}:
 *   get:
 *     summary: Obter um único QRR por ID
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *     responses:
 *       200:
 *         description: Detalhes do QRR
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/QRR'
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.get("/:id", protect, qrrController.getQRRById);

/**
 * @swagger
 * /api/qrrs/{id}/status:
 *   put:
 *     summary: Atualizar o status de um QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, active, completed, cancelled, expired]
 *                 description: Novo status do QRR
 *     responses:
 *       200:
 *         description: Status do QRR atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/QRR'
 *       400:
 *         description: Status inválido
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar o status deste QRR
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/status", protect, 
  [
    check("status", "Status é obrigatório").isIn(["pending", "active", "completed", "cancelled", "expired"])
  ],
  qrrController.updateQRRStatus
);

/**
 * @swagger
 * /api/qrrs/{id}:
 *   put:
 *     summary: Atualizar detalhes de um QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Novo título do QRR
 *               description:
 *                 type: string
 *                 description: Nova descrição do QRR
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: Nova hora de início do QRR (ISO 8601)
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: Nova hora de término do QRR (ISO 8601)
 *     responses:
 *       200:
 *         description: QRR atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/QRR'
 *       400:
 *         description: Erro de validação
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar este QRR
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put(
  "/:id",
  protect,
  [
    check("title", "Título é obrigatório").optional().not().isEmpty(),
    check("description", "Descrição é obrigatória").optional().not().isEmpty(),
    check("startTime", "Hora de início é obrigatória").optional().isISO8601(),
    check("endTime", "Hora de término é obrigatória").optional().isISO8601(),
  ],
  qrrController.updateQRR
);

/**
 * @swagger
 * /api/qrrs/{id}/join:
 *   post:
 *     summary: Entrar em um QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *     responses:
 *       200:
 *         description: Entrou no QRR com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Usuário já está no QRR ou QRR cheio
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.post("/:id/join", protect, qrrController.joinQRR);

/**
 * @swagger
 * /api/qrrs/{id}/leave:
 *   post:
 *     summary: Sair de um QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *     responses:
 *       200:
 *         description: Saiu do QRR com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Usuário não está no QRR
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.post("/:id/leave", protect, qrrController.leaveQRR);

/**
 * @swagger
 * /api/qrrs/{id}/mark-present:
 *   post:
 *     summary: Marcar presença em um QRR (para líderes de clã/administradores)
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - isPresent
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID do usuário a ser marcado
 *               isPresent:
 *                 type: boolean
 *                 description: Status de presença (true para presente, false para ausente)
 *     responses:
 *       200:
 *         description: Presença marcada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para marcar presença neste QRR
 *       404:
 *         description: QRR ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.post("/:id/mark-present", protect, 
  [
    check("userId", "ID do usuário é obrigatório").not().isEmpty(),
    check("isPresent", "Status de presença é obrigatório").isBoolean()
  ],
  qrrController.markPresence
);

/**
 * @swagger
 * /api/qrrs/{id}/participant/{userId}/performance:
 *   put:
 *     summary: Atualizar o desempenho de um participante em um QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do participante
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               performance:
 *                 type: string
 *                 description: Descrição do desempenho do participante
 *     responses:
 *       200:
 *         description: Desempenho do participante atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar o desempenho neste QRR
 *       404:
 *         description: QRR ou participante não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/api/qrrs/:id/participant/:userId/performance", protect, qrrController.updateParticipantPerformance);

/**
 * @swagger
 * /api/qrrs/{id}/complete:
 *   post:
 *     summary: Concluir um QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - success
 *             properties:
 *               success:
 *                 type: boolean
 *                 description: Indica se o QRR foi concluído com sucesso
 *     responses:
 *       200:
 *         description: QRR concluído com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para concluir este QRR
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.post("/:id/complete", protect, 
  [
    check("success", "Status de sucesso é obrigatório").isBoolean(),
  ],
  qrrController.completeQRR
);

/**
 * @swagger
 * /api/qrrs/{id}/cancel:
 *   post:
 *     summary: Cancelar um QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *     responses:
 *       200:
 *         description: QRR cancelado com sucesso
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
 *         description: Proibido, usuário não tem permissão para cancelar este QRR
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.post("/:id/cancel", protect, qrrController.cancelQRR);

/**
 * @swagger
 * /api/qrrs/{id}/accept-for-clan/{clanId}:
 *   put:
 *     summary: Aceitar um QRR de federação para um clã
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *       - in: path
 *         name: clanId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *     responses:
 *       200:
 *         description: QRR aceito para o clã com sucesso
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
 *         description: Proibido, usuário não tem permissão para aceitar QRR para este clã
 *       404:
 *         description: QRR ou clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/accept-for-clan/:clanId", protect, federationQRRController.acceptQRRForClan);

/**
 * @swagger
 * /api/qrrs/{id}/reject-for-clan/{clanId}:
 *   put:
 *     summary: Rejeitar um QRR de federação para um clã
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *       - in: path
 *         name: clanId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *     responses:
 *       200:
 *         description: QRR rejeitado para o clã com sucesso
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
 *         description: Proibido, usuário não tem permissão para rejeitar QRR para este clã
 *       404:
 *         description: QRR ou clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/reject-for-clan/:clanId", protect, federationQRRController.rejectQRRForClan);

/**
 * @swagger
 * /api/qrrs/{id}:
 *   delete:
 *     summary: Deletar um QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR a ser deletado
 *     responses:
 *       200:
 *         description: QRR deletado com sucesso
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
 *         description: Proibido, usuário não tem permissão para deletar este QRR
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.delete("/:id", protect, checkQRRPermission, qrrController.deleteQRR);

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     QRR:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único do QRR
 *         title:
 *           type: string
 *           description: Título do QRR
 *         description:
 *           type: string
 *           description: Descrição do QRR
 *         clan:
 *           type: string
 *           description: ID do clã ao qual o QRR pertence
 *         createdBy:
 *           type: string
 *           description: ID do usuário que criou o QRR
 *         startTime:
 *           type: string
 *           format: date-time
 *           description: Hora de início do QRR
 *         endTime:
 *           type: string
 *           format: date-time
 *           description: Hora de término do QRR
 *         status:
 *           type: string
 *           enum: [pending, active, completed, cancelled, expired]
 *           description: Status atual do QRR
 *         participants:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               user:
 *                 type: string
 *                 description: ID do participante
 *               isPresent:
 *                 type: boolean
 *                 description: Indica se o participante esteve presente
 *               performance:
 *                 type: string
 *                 description: Descrição do desempenho do participante
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data de criação do QRR
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização do QRR
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d1a"
 *         title: "Missão de Resgate na Floresta"
 *         description: "Resgatar os aldeões capturados pelos goblins."
 *         clan: "60d5ec49f8c7b7001c8e4d1b"
 *         createdBy: "60d5ec49f8c7b7001c8e4d1c"
 *         startTime: "2023-10-27T10:00:00Z"
 *         endTime: "2023-10-27T12:00:00Z"
 *         status: "active"
 *         participants:
 *           - user: "60d5ec49f8c7b7001c8e4d1d"
 *             isPresent: true
 *             performance: "Excelente desempenho em combate."
 *         createdAt: "2023-10-26T09:00:00Z"
 *         updatedAt: "2023-10-27T11:30:00Z"
 */


