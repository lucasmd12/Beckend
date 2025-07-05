// Backend: routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Call = require("../models/Call");
const Message = require("../models/Message");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Rotas de administração do sistema
 */

// Middleware para verificar se é admin
const checkAdmin = (req, res, next) => {
  if (req.user.role !== "ADM") {
    return res.status(403).json({ msg: "Acesso negado. Apenas administradores." });
  }
  next();
};

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Listar todos os usuários
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuários
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/UserAdmin"
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado. Apenas administradores.
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/users", protect, checkAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .select("-password")
      .sort({ createdAt: -1 });
    
    res.json({ users });
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    res.status(500).json({ msg: "Erro interno do servidor" });
  }
});

/**
 * @swagger
 * /api/admin/users/{userId}/role:
 *   put:
 *     summary: Alterar papel (role) de um usuário
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser alterado
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
 *                 enum: [ADM, adminReivindicado, user, descolado, Leader, SubLeader, member, federationAdmin]
 *                 description: Novo papel do usuário
 *     responses:
 *       200:
 *         description: Papel alterado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 user:
 *                   $ref: "#/components/schemas/UserAdmin"
 *       400:
 *         description: "Requisição inválida (ex: papel inválido, tentar alterar o próprio papel)"
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado. Apenas administradores.
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.put("/users/:userId/role", protect, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    const validRoles = ["ADM", "adminReivindicado", "user", "descolado", "Leader", "SubLeader", "member", "federationAdmin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ msg: "Papel inválido" });
    }
    
    if (userId === req.user.id) {
      return res.status(400).json({ msg: "Você não pode alterar seu próprio papel" });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select("-password");
    
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }
    
    res.json({ 
      msg: "Papel alterado com sucesso",
      user 
    });
  } catch (error) {
    console.error("Erro ao alterar papel:", error);
    res.status(500).json({ msg: "Erro interno do servidor" });
  }
});

/**
 * @swagger
 * /api/admin/users/{userId}/reset-password:
 *   post:
 *     summary: Resetar senha de um usuário
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário para resetar a senha
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: Nova senha para o usuário (mínimo 8 caracteres, com maiúscula, minúscula, número e símbolo)
 *     responses:
 *       200:
 *         description: Senha resetada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 resetAt:
 *                   type: string
 *                   format: date-time
 *                 resetBy:
 *                   type: string
 *       400:
 *         description: "Requisição inválida (ex: senha fraca, tentar resetar a própria senha)"
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado. Apenas administradores.
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/users/:userId/reset-password", protect, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({ msg: "Nova senha é obrigatória" });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ msg: "A senha deve ter pelo menos 8 caracteres" });
    }
    
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        msg: "A senha deve conter pelo menos: uma letra minúscula, uma maiúscula, um número e um símbolo especial" 
      });
    }
    
    if (userId === req.user.id) {
      return res.status(400).json({ msg: "Você não pode resetar sua própria senha através desta funcionalidade" });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }
    
    const bcrypt = require("bcryptjs");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    await User.findByIdAndUpdate(userId, { 
      password: hashedPassword,
      mustChangePasswordOnNextLogin: true,
      passwordResetBy: req.user.id,
      passwordResetAt: new Date()
    });
    
    console.log(`[ADMIN AUDIT] Senha resetada para usuário ${user.username} (ID: ${userId}) pelo admin ${req.user.username} (ID: ${req.user.id}) em ${new Date().toISOString()}`);
    
    res.json({ 
      msg: `Senha do usuário ${user.username} resetada com sucesso`,
      resetAt: new Date(),
      resetBy: req.user.username
    });
  } catch (error) {
    console.error("Erro ao resetar senha:", error);
    res.status(500).json({ msg: "Erro interno do servidor" });
  }
});

/**
 * @swagger
 * /api/admin/users/{userId}/suspend:
 *   post:
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
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Motivo da suspensão
 *               duration:
 *                 type: number
 *                 description: Duração da suspensão em dias (opcional)
 *     responses:
 *       200:
 *         description: Usuário suspenso com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 user:
 *                   $ref: "#/components/schemas/UserAdmin"
 *       400:
 *         description: "Requisição inválida (ex: tentar suspender a si mesmo)"
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado. Apenas administradores.
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/users/:userId/suspend", protect, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, duration } = req.body;
    
    if (userId === req.user.id) {
      return res.status(400).json({ msg: "Você não pode suspender a si mesmo" });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        suspended: true,
        suspensionReason: reason,
        suspensionExpiry: duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null
      },
      { new: true }
    ).select("-password");
    
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }
    
    res.json({ 
      msg: "Usuário suspenso com sucesso",
      user 
    });
  } catch (error) {
    console.error("Erro ao suspender usuário:", error);
    res.status(500).json({ msg: "Erro interno do servidor" });
  }
});

module.exports = router;

