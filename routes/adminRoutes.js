const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { protect } = require("../middleware/authMiddleware");
const { check } = require("express-validator");

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Rotas de administração do sistema
 */

/**
 * @swagger
 * /api/admin/dashboard-stats:
 *   get:
 *     summary: Obter estatísticas para o dashboard do ADM
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas do dashboard
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
 *                     totalUsers:
 *                       type: integer
 *                     totalClans:
 *                       type: integer
 *                     totalFederations:
 *                       type: integer
 *                     activeCalls:
 *                       type: integer
 *                     onlineUsers:
 *                       type: integer
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       500:
 *         description: Erro no servidor
 */
router.get("/dashboard-stats", protect, adminController.checkAdmin, adminController.getDashboardStats);

/**
 * @swagger
 * /api/admin/users/{userId}/set-role:
 *   put:
 *     summary: Definir o papel (role) de um usuário
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, leader, subLeader, ADM]
 *                 description: Novo papel do usuário
 *     responses:
 *       200:
 *         description: Papel do usuário atualizado com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put(
  "/users/:userId/set-role",
  protect,
  adminController.checkAdmin,
  [check("role", "O papel é obrigatório e deve ser um dos válidos.").isIn(["user", "leader", "subLeader", "ADM"])],
  adminController.setUserRole
);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   delete:
 *     summary: Apagar uma conta de usuário
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser apagado
 *     responses:
 *       200:
 *         description: Usuário apagado com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.delete("/users/:userId", protect, adminController.checkAdmin, adminController.deleteUser);

/**
 * @swagger
 * /api/admin/users/{userId}/ban:
 *   put:
 *     summary: Banir um usuário
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser banido
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Motivo do banimento
 *     responses:
 *       200:
 *         description: Usuário banido com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/users/:userId/ban", protect, adminController.checkAdmin, adminController.banUser);

/**
 * @swagger
 * /api/admin/users/{userId}/unban:
 *   put:
 *     summary: Desbanir um usuário
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser desbanido
 *     responses:
 *       200:
 *         description: Usuário desbanido com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/users/:userId/unban", protect, adminController.checkAdmin, adminController.unbanUser);

/**
 * @swagger
 * /api/admin/users/{userId}/suspend:
 *   put:
 *     summary: Suspender um usuário
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser suspenso
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - durationDays
 *             properties:
 *               durationDays:
 *                 type: integer
 *                 description: Duração da suspensão em dias
 *               reason:
 *                 type: string
 *                 description: Motivo da suspensão
 *     responses:
 *       200:
 *         description: Usuário suspenso com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/users/:userId/suspend", protect, adminController.checkAdmin, [
  check("durationDays", "A duração da suspensão em dias é obrigatória e deve ser um número.").isInt({ min: 1 })
], adminController.suspendUser);

/**
 * @swagger
 * /api/admin/users/{userId}/unsuspend:
 *   put:
 *     summary: Remover suspensão de um usuário
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ter a suspensão removida
 *     responses:
 *       200:
 *         description: Suspensão do usuário removida com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/users/:userId/unsuspend", protect, adminController.checkAdmin, adminController.unsuspendUser);

module.exports = router;


