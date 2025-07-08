const express = require("express");
const multer = require("multer");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");
const authorizeSelfOrAdmin = require("../middleware/authorizeSelfOrAdmin");
const userController = require("../controllers/userController"); // Adicionado
const router = express.Router();
const fs = require("fs");

/**
 * @swagger
 * tags:
 *   name: Usuários
 *   description: Gerenciamento de perfis de usuários e informações relacionadas
 */

// Multer setup para upload de fotos de perfil
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos de imagem são permitidos!"), false);
    }
  },
});

/**
 * @swagger
 * /api/users/{id}/foto:
 *   post:
 *     summary: Upload de foto de perfil para um usuário
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               foto:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo de imagem para a foto de perfil (max 5MB)
 *     responses:
 *       200:
 *         description: Foto de perfil atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 fotoPerfil:
 *                   type: string
 *                   description: "URL da nova foto de perfil"
 *       400:
 *         description: "Requisição inválida (ex: nenhum arquivo, arquivo não é imagem, tamanho excedido)"
 *       401:
 *         description: Não autorizado, token ausente ou inválido
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar este perfil
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.post(
  "/users/:id/foto",
  protect,
  authorizeSelfOrAdmin,
  upload.single("foto"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo de imagem enviado." });
      }
      const imagePath = `uploads/${req.file.filename}`;
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { fotoPerfil: imagePath },
        { new: true, runValidators: true }
      ).select("-password");
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado." });
      }
      res.json({ success: true, message: "Foto de perfil atualizada com sucesso!", fotoPerfil: imagePath });
    } catch (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Erro no upload: ${err.message}` });
      }
      if (err.message === "Apenas arquivos de imagem são permitidos!") {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: "Erro interno do servidor ao atualizar foto." });
    }
  }
);

/**
 * @swagger
 * /api/cla/{id}/membros:
 *   get:
 *     summary: Listar membros de um clã específico
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *     responses:
 *       200:
 *         description: Lista de membros do clã retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 membros:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       username:
 *                         type: string
 *                       fotoPerfil:
 *                         type: string
 *                         nullable: true
 *                         online:
 *                           type: boolean
 *                           description: "Status online do usuário"
 *       403:
 *         description: Proibido, usuário não é membro do clã ou não é ADM
 *       500:
 *         description: Erro no servidor
 */
router.get("/cla/:id/membros", protect, async (req, res) => {
  try {
    const idCla = req.params.id;
    const requestingUser = await User.findById(req.user.id);

    // Permitir só membros do clã ou ADM
    if (
      requestingUser.role !== "ADM" &&
      (!requestingUser.clan || requestingUser.clan.toString() !== idCla)
    ) {
      return res.status(403).json({ error: "Não autorizado a ver membros deste clã." });
    }

    const membros = await User.find({ clan: idCla }).select("username fotoPerfil ultimaAtividade");

    const agora = new Date();
    const membrosFormatados = membros.map((membro) => {
      const ultimaAtividade = membro.ultimaAtividade || new Date(0);
      const minutosInativo = (agora.getTime() - ultimaAtividade.getTime()) / 60000;
      const online = minutosInativo <= 5;
      return {
        username: membro.username,
        fotoPerfil: membro.fotoPerfil || null,
        online: online,
      };
    });

    res.json({ success: true, membros: membrosFormatados });
  } catch (err) {
    res.status(500).json({ error: "Erro interno do servidor ao buscar membros do clã." });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Obter informações de um usuário por ID
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Informações do usuário retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Não autorizado, token ausente ou inválido
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 *   put:
 *     summary: Atualizar informações de perfil de um usuário
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser atualizado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: Novo nome de usuário
 *               bio:
 *                 type: string
 *                 description: Nova biografia do usuário
 *     responses:
 *       200:
 *         description: Perfil do usuário atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Não autorizado, token ausente ou inválido
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar este perfil
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
// Novas rotas usando userController
router.get("/search", protect, userController.searchUsers);
router.get("/online", protect, userController.getOnlineUsers);
router.put("/profile", protect, userController.updateProfile);
router.get("/:id/stats", protect, userController.getUserStats);

router.get("/users/:id", protect, userController.getUserById);

router.put("/users/:id", protect, authorizeSelfOrAdmin, async (req, res) => {
  try {
    const { username, bio } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
    if (username) user.username = username;
    if (bio) user.bio = bio;
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: "Erro interno do servidor ao editar perfil." });
  }
});

module.exports = router;


/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único do usuário
 *         username:
 *           type: string
 *           description: Nome de usuário único
 *         role:
 *           type: string
 *           description: "Papel do usuário (ex: user, admin, leader)"
 *         avatar:
 *           type: string
 *           description: URL do avatar do usuário
 *           nullable: true
 *         bio:
 *           type: string
 *           description: Biografia do usuário
 *           nullable: true
 *         clan:
 *           type: string
 *           description: ID do clã ao qual o usuário pertence
 *           nullable: true
 *         federation:
 *           type: string
 *           description: ID da federação à qual o usuário pertence
 *           nullable: true
 *         lastSeen:
 *           type: string
 *           format: date-time
 *           description: Última vez que o usuário esteve online
 *         online:
 *           type: boolean
 *           description: Status online do usuário
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d1a"
 *         username: "testuser"
 *         role: "user"
 *         avatar: "https://example.com/avatar.png"
 *         bio: "Um usuário de teste."
 *         clan: "60d5ec49f8c7b7001c8e4d1b"
 *         federation: "60d5ec49f8c7b7001c8e4d1c"
 *         lastSeen: "2023-10-27T10:00:00Z"
 *         online: true
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */


