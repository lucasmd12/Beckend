
/**
 * @swagger
 * tags:
 *   name: Federações
 *   description: Gerenciamento de federações de clãs
 */

/**
 * @swagger
 * /api/federations:
 *   get:
 *     summary: Obter todas as federações
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de todas as federações
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
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       leader:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           username:
 *                             type: string
 *                           avatar:
 *                             type: string
 *                       clans:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             name:
 *                               type: string
 *                             tag:
 *                               type: string
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/federations/{id}:
 *   get:
 *     summary: Obter uma federação específica por ID
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *     responses:
 *       200:
 *         description: Detalhes da federação
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
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     leader:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         username:
 *                           type: string
 *                         avatar:
 *                           type: string
 *                     clans:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           tag:
 *                             type: string
 *                     allies:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                     enemies:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/federations:
 *   post:
 *     summary: Criar uma nova federação (apenas ADM)
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome da federação
 *               description:
 *                 type: string
 *                 description: Descrição da federação
 *     responses:
 *       200:
 *         description: Federação criada com sucesso
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
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     leader:
 *                       type: string
 *       400:
 *         description: Erro de validação
 *       403:
 *         description: Acesso negado. Permissão de ADM necessária.
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/federations/{id}:
 *   put:
 *     summary: Atualizar informações de uma federação (líder ou ADM)
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação a ser atualizada
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Novo nome da federação
 *               description:
 *                 type: string
 *                 description: Nova descrição da federação
 *               rules:
 *                 type: string
 *                 description: Novas regras da federação
 *     responses:
 *       200:
 *         description: Federação atualizada com sucesso
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
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     rules:
 *                       type: string
 *       403:
 *         description: Permissão insuficiente
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/federations/{id}/banner:
 *   put:
 *     summary: Atualizar o banner de uma federação (líder ou ADM)
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               banner:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo de imagem para o banner (jpeg, jpg, png, gif, max 5MB)
 *     responses:
 *       200:
 *         description: Banner da federação atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 banner:
 *                   type: string
 *                   description: URL do novo banner da federação
 *       400:
 *         description: Nenhum arquivo enviado ou tipo de arquivo inválido
 *       403:
 *         description: Permissão insuficiente
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/federations/{id}/add-clan/{clanId}:
 *   put:
 *     summary: Adicionar um clã a uma federação (líder da federação ou ADM)
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *       - in: path
 *         name: clanId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã a ser adicionado
 *     responses:
 *       200:
 *         description: Clã adicionado à federação com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 msg:
 *                   type: string
 *       400:
 *         description: Clã já pertence a uma federação ou já está nesta federação
 *       403:
 *         description: Permissão insuficiente
 *       404:
 *         description: Federação ou clã não encontrado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/federations/{id}/remove-clan/{clanId}:
 *   put:
 *     summary: Remover um clã de uma federação (líder da federação, líder do clã ou ADM)
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *       - in: path
 *         name: clanId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã a ser removido
 *     responses:
 *       200:
 *         description: Clã removido da federação com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 msg:
 *                   type: string
 *       400:
 *         description: Clã não pertence a esta federação
 *       403:
 *         description: Permissão insuficiente
 *       404:
 *         description: Federação ou clã não encontrado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/federations/{id}/promote/{userId}:
 *   put:
 *     summary: Promover um líder de clã a sub-líder da federação (líder da federação ou ADM)
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário (líder de clã) a ser promovido
 *     responses:
 *       200:
 *         description: Usuário promovido a sub-líder com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 msg:
 *                   type: string
 *       400:
 *         description: Usuário já é sub-líder ou não é líder de clã da federação
 *       403:
 *         description: Permissão insuficiente
 *       404:
 *         description: Federação ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/federations/{id}/demote/{userId}:
 *   put:
 *     summary: Rebaixar um sub-líder da federação a membro comum (líder da federação ou ADM)
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser rebaixado
 *     responses:
 *       200:
 *         description: Sub-líder rebaixado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 msg:
 *                   type: string
 *       400:
 *         description: Usuário não é sub-líder
 *       403:
 *         description: Permissão insuficiente
 *       404:
 *         description: Federação ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/federations/{id}/transfer/{userId}:
 *   put:
 *     summary: Transferir liderança da federação (líder da federação ou ADM)
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário para quem a liderança será transferida
 *     responses:
 *       200:
 *         description: Liderança transferida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 msg:
 *                   type: string
 *       400:
 *         description: Usuário não é líder de clã da federação
 *       403:
 *         description: Permissão insuficiente
 *       404:
 *         description: Federação ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/federations/{id}/ally/{allyId}:
 *   put:
 *     summary: Adicionar uma federação como aliada (líder da federação ou ADM)
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *       - in: path
 *         name: allyId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação aliada a ser adicionada
 *     responses:
 *       200:
 *         description: Federação adicionada como aliada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 msg:
 *                   type: string
 *       400:
 *         description: Esta federação já é sua aliada
 *       403:
 *         description: Permissão insuficiente
 *       404:
 *         description: Federação ou federação aliada não encontrada
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/federations/{id}/enemy/{enemyId}:
 *   put:
 *     summary: Adicionar uma federação como inimiga (líder da federação ou ADM)
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *       - in: path
 *         name: enemyId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação inimiga a ser adicionada
 *     responses:
 *       200:
 *         description: Federação adicionada como inimiga com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 msg:
 *                   type: string
 *       400:
 *         description: Esta federação já é sua inimiga
 *       403:
 *         description: Permissão insuficiente
 *       404:
 *         description: Federação ou federação inimiga não encontrada
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/federations/{id}:
 *   delete:
 *     summary: Deletar uma federação (líder da federação ou ADM)
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação a ser deletada
 *     responses:
 *       200:
 *         description: Federação deletada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 msg:
 *                   type: string
 *       403:
 *         description: Permissão insuficiente
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */

const express = require("express");
const router = express.Router();
const Federation = require("../models/Federation");
const Clan = require("../models/Clan");
const User = require("../models/User");
const { protect: auth } = require("../middleware/authMiddleware");
const authorizeFederationLeaderOrADM = require("../middleware/authorizeFederationLeaderOrADM");
const { check, validationResult } = require("express-validator");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/federation_banners";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Apenas imagens são permitidas"));
  },
});

// Middleware para ADM (usado só na criação)
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "ROLE_ADM") return next();
  return res.status(403).json({ msg: "Acesso negado. Permissão de ADM necessária." });
};

// GET todas as federações
router.get("/", auth, async (req, res) => {
  try {
    const federations = await Federation.find()
      .populate("leader", "username avatar")
      .populate("subLeaders", "username avatar")
      .populate("clans", "name tag");
    res.json({ success: true, data: federations });
  } catch (err) {
    res.status(500).json({ msg: "Erro no servidor" });
  }
});

// GET federação específica
router.get("/:id", auth, async (req, res) => {
  try {
    const federation = await Federation.findById(req.params.id)
      .populate("leader", "username avatar")
      .populate("subLeaders", "username avatar")
      .populate("clans", "name tag leader")
      .populate("allies", "name")
      .populate("enemies", "name");
    if (!federation) return res.status(404).json({ msg: "Federação não encontrada" });
    res.json({ success: true, data: federation });
  } catch (err) {
    res.status(500).json({ msg: "Erro no servidor" });
  }
});

// POST criar federação (apenas ADM)
router.post(
  "/",
  [
    auth,
    isAdmin,
    [check("name", "Nome é obrigatório").not().isEmpty()],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { name, description } = req.body;
      const newFederation = new Federation({
        name,
        description,
        leader: req.user.id,
      });
      const federation = await newFederation.save();
      res.json({ success: true, data: federation });
    } catch (err) {
      res.status(500).json({ msg: "Erro no servidor" });
    }
  }
);

// PUT atualizar federação (líder ou ADM)
router.put("/:id", auth, authorizeFederationLeaderOrADM, async (req, res) => {
  try {
    const federation = req.federation;
    const { name, description, rules } = req.body;
    if (name) federation.name = name;
    if (description) federation.description = description;
    if (rules) federation.rules = rules;
    await federation.save();
    res.json({ success: true, data: federation });
  } catch (err) {
    res.status(500).json({ msg: "Erro no servidor" });
  }
});

// PUT atualizar banner
router.put(
  "/:id/banner",
  [auth, authorizeFederationLeaderOrADM, upload.single("banner")],
  async (req, res) => {
    try {
      const federation = req.federation;
      if (!req.file) return res.status(400).json({ msg: "Nenhum arquivo enviado" });
      if (federation.banner) {
        const oldPath = path.join(__dirname, "..", federation.banner);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      federation.banner = req.file.path;
      await federation.save();
      res.json({ success: true, banner: federation.banner });
    } catch (err) {
      res.status(500).json({ msg: "Erro no servidor" });
    }
  }
);

// PUT adicionar clã
router.put("/:id/add-clan/:clanId", auth, authorizeFederationLeaderOrADM, async (req, res) => {
  try {
    const federation = req.federation;
    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ msg: "Clã não encontrado" });
    if (clan.federation) {
      return res.status(400).json({ msg: "Este clã já pertence a uma federação. Saia dela primeiro." });
    }
    if (federation.clans.includes(req.params.clanId)) {
      return res.status(400).json({ msg: "Este clã já pertence a esta federação" });
    }
    federation.clans.push(req.params.clanId);
    await federation.save();
    clan.federation = federation._id;
    await clan.save();
    res.json({ success: true, msg: "Clã adicionado à federação com sucesso" });
  } catch (err) {
    res.status(500).json({ msg: "Erro no servidor" });
  }
});

// PUT remover clã (líder federação, líder clã ou ADM)
router.put("/:id/remove-clan/:clanId", auth, async (req, res) => {
  try {
    const federation = await Federation.findById(req.params.id);
    const clan = await Clan.findById(req.params.clanId);
    if (!federation || !clan) return res.status(404).json({ msg: "Federação ou clã não encontrado" });
    if (
      federation.leader.toString() !== req.user.id &&
      clan.leader.toString() !== req.user.id &&
      req.user.role !== "ROLE_ADM"
    ) {
      return res.status(403).json({ msg: "Permissão insuficiente para remover clã" });
    }
    if (!federation.clans.includes(req.params.clanId)) {
      return res.status(400).json({ msg: "Este clã não pertence a esta federação" });
    }
    federation.clans = federation.clans.filter(
      (clanId) => clanId.toString() !== req.params.clanId
    );
    await federation.save();
    clan.federation = null;
    await clan.save();
    res.json({ success: true, msg: "Clã removido da federação com sucesso" });
  } catch (err) {
    res.status(500).json({ msg: "Erro no servidor" });
  }
});

// PUT promover sub-líder
router.put("/:id/promote/:userId", auth, authorizeFederationLeaderOrADM, async (req, res) => {
  try {
    const federation = req.federation;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ msg: "Usuário não encontrado" });
    if (federation.subLeaders.includes(req.params.userId)) {
      return res.status(400).json({ msg: "Este usuário já é sub-líder" });
    }
    const userClan = await Clan.findOne({ leader: req.params.userId });
    if (!userClan || !federation.clans.includes(userClan._id)) {
      return res.status(400).json({ msg: "Apenas líderes de clãs da federação podem ser promovidos" });
    }
    federation.subLeaders.push(req.params.userId);
    await federation.save();
    user.federationRole = "ROLE_FED_SUBLEADER";
    await user.save();
    res.json({ success: true, msg: "Usuário promovido a sub-líder com sucesso" });
  } catch (err) {
    res.status(500).json({ msg: "Erro no servidor" });
  }
});

// PUT rebaixar sub-líder
router.put("/:id/demote/:userId", auth, authorizeFederationLeaderOrADM, async (req, res) => {
  try {
    const federation = req.federation;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ msg: "Usuário não encontrado" });
    if (!federation.subLeaders.includes(req.params.userId)) {
      return res.status(400).json({ msg: "Este usuário não é sub-líder" });
    }
    federation.subLeaders = federation.subLeaders.filter(
      (subLeader) => subLeader.toString() !== req.params.userId
    );
    await federation.save();
    user.federationRole = null;
    await user.save();
    res.json({ success: true, msg: "Sub-líder rebaixado com sucesso" });
  } catch (err) {
    res.status(500).json({ msg: "Erro no servidor" });
  }
});

// PUT transferir liderança
router.put("/:id/transfer/:userId", auth, authorizeFederationLeaderOrADM, async (req, res) => {
  try {
    const federation = req.federation;
    const newLeader = await User.findById(req.params.userId);
    if (!newLeader) return res.status(404).json({ msg: "Usuário não encontrado" });
    const userClan = await Clan.findOne({ leader: req.params.userId });
    if (!userClan || !federation.clans.includes(userClan._id)) {
      return res.status(400).json({ msg: "Apenas líderes de clãs da federação podem se tornar líderes" });
    }
    const oldLeaderId = federation.leader;
    federation.leader = req.params.userId;
    federation.subLeaders = federation.subLeaders.filter(
      (subLeader) => subLeader.toString() !== req.params.userId
    );
    if (!federation.subLeaders.includes(oldLeaderId)) {
      federation.subLeaders.push(oldLeaderId);
    }
    await federation.save();
    newLeader.federationRole = "ROLE_FED_LEADER";
    await newLeader.save();
    const oldLeader = await User.findById(oldLeaderId);
    if (oldLeader) {
      oldLeader.federationRole = "ROLE_FED_SUBLEADER";
      await oldLeader.save();
    }
    res.json({ success: true, msg: "Liderança transferida com sucesso" });
  } catch (err) {
    res.status(500).json({ msg: "Erro no servidor" });
  }
});

// PUT adicionar aliado
router.put("/:id/ally/:allyId", auth, authorizeFederationLeaderOrADM, async (req, res) => {
  try {
    const federation = req.federation;
    const allyFederation = await Federation.findById(req.params.allyId);
    if (!allyFederation) return res.status(404).json({ msg: "Federação aliada não encontrada" });
    if (federation.allies.includes(req.params.allyId)) {
      return res.status(400).json({ msg: "Esta federação já é sua aliada" });
    }
    if (federation.enemies.includes(req.params.allyId)) {
      federation.enemies = federation.enemies.filter(
        (enemy) => enemy.toString() !== req.params.allyId
      );
    }
    federation.allies.push(req.params.allyId);
    await federation.save();
    res.json({ success: true, msg: "Federação adicionada como aliada com sucesso" });
  } catch (err) {
    res.status(500).json({ msg: "Erro no servidor" });
  }
});

// PUT adicionar inimiga
router.put("/:id/enemy/:enemyId", auth, authorizeFederationLeaderOrADM, async (req, res) => {
  try {
    const federation = req.federation;
    const enemyFederation = await Federation.findById(req.params.enemyId);
    if (!enemyFederation) return res.status(404).json({ msg: "Federação inimiga não encontrada" });
    if (federation.enemies.includes(req.params.enemyId)) {
      return res.status(400).json({ msg: "Esta federação já é sua inimiga" });
    }
    if (federation.allies.includes(req.params.enemyId)) {
      federation.allies = federation.allies.filter(
        (ally) => ally.toString() !== req.params.enemyId
      );
    }
    federation.enemies.push(req.params.enemyId);
    await federation.save();
    res.json({ success: true, msg: "Federação adicionada como inimiga com sucesso" });
  } catch (err) {
    res.status(500).json({ msg: "Erro no servidor" });
  }
});

// DELETE federação
router.delete("/:id", auth, authorizeFederationLeaderOrADM, async (req, res) => {
  try {
    const federation = req.federation;
    if (federation.banner) {
      const bannerPath = path.join(__dirname, "..", federation.banner);
      if (fs.existsSync(bannerPath)) fs.unlinkSync(bannerPath);
    }
    await Clan.updateMany(
      { federation: federation._id },
      { $set: { federation: null } }
    );
    await User.updateMany(
      { federationRole: { $in: ["ROLE_FED_LEADER", "ROLE_FED_SUBLEADER"] } },
      { $set: { federationRole: null } }
    );
    await federation.remove();
    res.json({ success: true, msg: "Federação deletada com sucesso" });
  } catch (err) {
    res.status(500).json({ msg: "Erro no servidor" });
  }
});

module.exports = router;


