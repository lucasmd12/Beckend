
/**
 * @swagger
 * tags:
 *   name: Clãs
 *   description: Gerenciamento de clãs
 */

/**
 * @swagger
 * /api/clans:
 *   get:
 *     summary: Obter todos os clãs
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de todos os clãs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   tag:
 *                     type: string
 *                   leader:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       username:
 *                         type: string
 *                       avatar:
 *                         type: string
 *                   members:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         username:
 *                           type: string
 *                         avatar:
 *                           type: string
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/clans/{id}:
 *   get:
 *     summary: Obter um clã específico por ID
 *     tags: [Clãs]
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
 *         description: Detalhes do clã
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 tag:
 *                   type: string
 *                 leader:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                 members:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       username:
 *                         type: string
 *                       avatar:
 *                         type: string
 *                 federation:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/clans:
 *   post:
 *     summary: Criar um novo clã
 *     tags: [Clãs]
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
 *               - tag
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome do clã
 *               tag:
 *                 type: string
 *                 description: Tag do clã (máximo 5 caracteres)
 *               description:
 *                 type: string
 *                 description: Descrição do clã
 *     responses:
 *       200:
 *         description: Clã criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 tag:
 *                   type: string
 *                 leader:
 *                   type: string
 *                 members:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Erro de validação ou usuário já pertence a um clã ou tag já em uso
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/clans/{id}:
 *   put:
 *     summary: Atualizar informações de um clã
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã a ser atualizado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Novo nome do clã
 *               description:
 *                 type: string
 *                 description: Nova descrição do clã
 *               rules:
 *                 type: string
 *                 description: Novas regras do clã
 *     responses:
 *       200:
 *         description: Clã atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 description:
 *                   type: string
 *                 rules:
 *                   type: string
 *       401:
 *         description: Não autorizado (apenas líder do clã)
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/clans/{id}/banner:
 *   put:
 *     summary: Atualizar a bandeira (banner) de um clã
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               banner:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo de imagem para o banner (jpeg, jpg, png, gif, max 5MB)
 *     responses:
 *       200:
 *         description: Bandeira do clã atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 banner:
 *                   type: string
 *                   description: URL da nova bandeira do clã
 *       400:
 *         description: Nenhum arquivo enviado ou tipo de arquivo inválido
 *       401:
 *         description: Não autorizado (apenas líder do clã)
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/clans/{id}/join:
 *   put:
 *     summary: Solicitar entrada em um clã
 *     tags: [Clãs]
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
 *         description: Entrou no clã com sucesso
 *       400:
 *         description: Usuário já pertence a um clã ou já é membro deste clã
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/clans/{id}/leave:
 *   put:
 *     summary: Sair de um clã
 *     tags: [Clãs]
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
 *         description: Saiu do clã com sucesso
 *       400:
 *         description: Líder não pode sair sem transferir liderança ou usuário não é membro do clã
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/clans/{id}/promote/{userId}:
 *   put:
 *     summary: Promover um membro a sub-líder
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser promovido
 *     responses:
 *       200:
 *         description: Membro promovido a sub-líder com sucesso
 *       400:
 *         description: Usuário não é membro do clã ou já é sub-líder
 *       401:
 *         description: Não autorizado (apenas líder do clã)
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/clans/{id}/demote/{userId}:
 *   put:
 *     summary: Rebaixar um sub-líder a membro comum
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser rebaixado
 *     responses:
 *       200:
 *         description: Sub-líder rebaixado a membro com sucesso
 *       400:
 *         description: Usuário não é sub-líder
 *       401:
 *         description: Não autorizado (apenas líder do clã)
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/clans/{id}/transfer/{userId}:
 *   put:
 *     summary: Transferir liderança do clã
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário para quem a liderança será transferida
 *     responses:
 *       200:
 *         description: Liderança transferida com sucesso
 *       400:
 *         description: Usuário não é membro do clã
 *       401:
 *         description: Não autorizado (apenas líder do clã)
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/clans/{id}/kick/{userId}:
 *   put:
 *     summary: Expulsar um membro do clã
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser expulso
 *     responses:
 *       200:
 *         description: Membro expulso com sucesso
 *       400:
 *         description: Usuário não é membro do clã
 *       401:
 *         description: Não autorizado (apenas líder ou sub-líder do clã)
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/clans/{id}:
 *   delete:
 *     summary: Deletar um clã
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã a ser deletado
 *     responses:
 *       200:
 *         description: Clã deletado com sucesso
 *       401:
 *         description: Não autorizado (apenas líder do clã)
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/clans/{id}/ally/{allyId}:
 *   put:
 *     summary: Adicionar um clã como aliado
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: allyId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã aliado a ser adicionado
 *     responses:
 *       200:
 *         description: Clã adicionado como aliado com sucesso
 *       400:
 *         description: Este clã já é seu aliado
 *       401:
 *         description: Não autorizado (apenas líder do clã)
 *       404:
 *         description: Clã ou clã aliado não encontrado
 *       500:
 *         description: Erro no servidor
 */

/**
 * @swagger
 * /api/clans/{id}/enemy/{enemyId}:
 *   put:
 *     summary: Adicionar um clã como inimigo
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: enemyId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã inimigo a ser adicionado
 *     responses:
 *       200:
 *         description: Clã adicionado como inimigo com sucesso
 *       400:
 *         description: Este clã já é seu inimigo
 *       401:
 *         description: Não autorizado (apenas líder do clã)
 *       404:
 *         description: Clã ou clã inimigo não encontrado
 *       500:
 *         description: Erro no servidor
 */

const express = require("express");
const router = express.Router();
const Clan = require("../models/Clan");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware").protect;
const authorizeRole = require("../middleware/authorizeRole"); // IMPORTANTE!
const { check, validationResult } = require("express-validator");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configuração do Multer para upload de imagens
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/clan_banners";
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Apenas imagens são permitidas"));
  },
});

// @route   GET /api/clans
// @desc    Obter todos os clãs
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const clans = await Clan.find()
      .populate("leader", "username avatar")
      .populate("subLeaders", "username avatar")
      .populate("members", "username avatar")
      .populate("federation", "name");
    res.json(clans);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erro no servidor");
  }
});

// @route   GET /api/clans/:id
// @desc    Obter um clã específico
// @access  Private
router.get("/:id", auth, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id)
      .populate("leader", "username avatar")
      .populate("subLeaders", "username avatar")
      .populate("members", "username avatar")
      .populate("federation", "name")
      .populate("allies", "name tag")
      .populate("enemies", "name tag");

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    res.json(clan);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   POST /api/clans
// @desc    Criar um novo clã
// @access  Private (apenas usuário sem clã, pode adicionar authorizeRole se quiser limitar a ADM)
router.post(
  "/",
  [
    auth,
    [
      check("name", "Nome é obrigatório").not().isEmpty(),
      check("tag", "TAG é obrigatória").not().isEmpty(),
      check("tag", "TAG não pode ter mais de 5 caracteres").isLength({
        max: 5,
      }),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Verificar se o usuário já tem um clã
      const user = await User.findById(req.user.id);
      if (user.clan) {
        return res
          .status(400)
          .json({ msg: "Você já pertence a um clã. Saia dele primeiro." });
      }

      // Verificar se a TAG já está em uso
      const existingClan = await Clan.findOne({ tag: req.body.tag });
      if (existingClan) {
        return res.status(400).json({ msg: "Esta TAG já está em uso" });
      }

      const { name, tag, description } = req.body;

      // Criar novo clã
      const newClan = new Clan({
        name,
        tag,
        description,
        leader: req.user.id,
        members: [req.user.id],
      });

      const clan = await newClan.save();

      // Atualizar o usuário com o ID do clã e papel de líder
      await User.findByIdAndUpdate(req.user.id, {
        clan: clan._id,
        clanRole: "leader",
      });

      res.json(clan);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Erro no servidor");
    }
  }
);

// @route   PUT /api/clans/:id
// @desc    Atualizar um clã
// @access  Private (apenas líder)
router.put("/:id", auth, authorizeRole("leader"), async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // O authorizeRole já garante que só o líder pode atualizar

    const { name, description, rules } = req.body;

    // Atualizar campos
    if (name) clan.name = name;
    if (description) clan.description = description;
    if (rules) clan.rules = rules;

    await clan.save();
    res.json(clan);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   PUT /api/clans/:id/banner
// @desc    Atualizar a bandeira do clã
// @access  Private (apenas líder)
router.put(
  "/:id/banner",
  [auth, authorizeRole("leader"), upload.single("banner")],
  async (req, res) => {
    try {
      const clan = await Clan.findById(req.params.id);

      if (!clan) {
        return res.status(404).json({ msg: "Clã não encontrado" });
      }

      // O authorizeRole já garante que só o líder pode atualizar a bandeira

      if (!req.file) {
        return res.status(400).json({ msg: "Nenhum arquivo enviado" });
      }

      // Remover bandeira antiga se existir
      if (clan.banner) {
        const oldPath = path.join(__dirname, "..", clan.banner);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      // Atualizar caminho da bandeira
      clan.banner = req.file.path;
      await clan.save();

      res.json({ banner: clan.banner });
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(404).json({ msg: "Clã não encontrado" });
      }
      res.status(500).send("Erro no servidor");
    }
  }
);

// @route   PUT /api/clans/:id/join
// @desc    Solicitar entrada em um clã
// @access  Private
router.put("/:id/join", auth, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    const user = await User.findById(req.user.id);
    if (user.clan) {
      return res
        .status(400)
        .json({ msg: "Você já pertence a um clã. Saia dele primeiro." });
    }

    if (clan.members.includes(req.user.id)) {
      return res.status(400).json({ msg: "Você já é membro deste clã" });
    }

    clan.members.push(req.user.id);
    await clan.save();

    await User.findByIdAndUpdate(req.user.id, {
      clan: clan._id,
      clanRole: "member",
    });

    res.json({ msg: "Você entrou no clã com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   PUT /api/clans/:id/leave
// @desc    Sair de um clã
// @access  Private
router.put("/:id/leave", auth, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // Líder não pode sair sem transferir liderança
    if (clan.leader.toString() === req.user.id) {
      return res
        .status(400)
        .json({
          msg: "Líderes não podem sair do clã. Transfira a liderança primeiro ou delete o clã.",
        });
    }

    if (!clan.members.includes(req.user.id)) {
      return res.status(400).json({ msg: "Você não é membro deste clã" });
    }

    clan.members = clan.members.filter(
      (member) => member.toString() !== req.user.id
    );
    clan.subLeaders = clan.subLeaders.filter(
      (subLeader) => subLeader.toString() !== req.user.id
    );
    await clan.save();

    await User.findByIdAndUpdate(req.user.id, {
      clan: null,
      clanRole: null,
    });

    res.json({ msg: "Você saiu do clã com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   PUT /api/clans/:id/promote/:userId
// @desc    Promover um membro a sub-líder
// @access  Private (apenas líder)
router.put("/:id/promote/:userId", auth, authorizeRole("leader"), async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // O authorizeRole já garante que só o líder pode promover

    if (!clan.members.includes(req.params.userId)) {
      return res.status(400).json({ msg: "Este usuário não é membro do clã" });
    }

    if (clan.subLeaders.includes(req.params.userId)) {
      return res.status(400).json({ msg: "Este usuário já é sub-líder" });
    }

    clan.subLeaders.push(req.params.userId);
    await clan.save();

    await User.findByIdAndUpdate(req.params.userId, {
      clanRole: "subleader",
    });

    res.json({ msg: "Membro promovido a sub-líder com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Clã ou usuário não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   PUT /api/clans/:id/demote/:userId
// @desc    Rebaixar um sub-líder a membro comum
// @access  Private (apenas líder)
router.put("/:id/demote/:userId", auth, authorizeRole("leader"), async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // O authorizeRole já garante que só o líder pode rebaixar

    if (!clan.subLeaders.includes(req.params.userId)) {
      return res.status(400).json({ msg: "Este usuário não é sub-líder" });
    }

    clan.subLeaders = clan.subLeaders.filter(
      (subLeader) => subLeader.toString() !== req.params.userId
    );
    await clan.save();

    await User.findByIdAndUpdate(req.params.userId, {
      clanRole: "member",
    });

    res.json({ msg: "Sub-líder rebaixado a membro com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Clã ou usuário não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   PUT /api/clans/:id/transfer/:userId
// @desc    Transferir liderança do clã
// @access  Private (apenas líder)
router.put(
  "/:id/transfer/:userId",
  [auth, authorizeRole("leader")],
  async (req, res) => {
    try {
      const clan = await Clan.findById(req.params.id);

      if (!clan) {
        return res.status(404).json({ msg: "Clã não encontrado" });
      }

      // O authorizeRole já garante que só o líder pode transferir

      // Verificar se o usuário a receber a liderança é membro
      if (!clan.members.includes(req.params.userId)) {
        return res.status(400).json({ msg: "Este usuário não é membro do clã" });
      }

      // Atualizar líder
      const oldLeaderId = clan.leader;
      clan.leader = req.params.userId;

      // Remover novo líder da lista de sub-líderes se estiver lá
      clan.subLeaders = clan.subLeaders.filter(
        (subLeader) => subLeader.toString() !== req.params.userId
      );

      // Adicionar antigo líder como sub-líder
      if (!clan.subLeaders.includes(oldLeaderId)) {
        clan.subLeaders.push(oldLeaderId);
      }

      await clan.save();

      // Atualizar papéis dos usuários
      await User.findByIdAndUpdate(req.params.userId, {
        clanRole: "leader",
      });
      await User.findByIdAndUpdate(req.user.id, {
        clanRole: "subleader",
      });

      res.json({ msg: "Liderança transferida com sucesso" });
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(404).json({ msg: "Clã ou usuário não encontrado" });
      }
      res.status(500).send("Erro no servidor");
    }
  }
);

// @route   PUT /api/clans/:id/kick/:userId
// @desc    Expulsar um membro do clã
// @access  Private (líder e sub-líderes)
router.put(
  "/:id/kick/:userId",
  [auth, authorizeRole(["leader", "subleader"])],
  async (req, res) => {
    try {
      const clan = await Clan.findById(req.params.id);

      if (!clan) {
        return res.status(404).json({ msg: "Clã não encontrado" });
      }

      // Verificar se o usuário é líder ou sub-líder
      const isLeader = clan.leader.toString() === req.user.id;
      const isSubLeader = clan.subLeaders.includes(req.user.id);

      if (!isLeader && !isSubLeader) {
        return res
          .status(401)
          .json({ msg: "Apenas líderes e sub-líderes podem expulsar membros" });
      }

      // Sub-líderes não podem expulsar outros sub-líderes ou o líder
      if (
        isSubLeader &&
        (clan.subLeaders.includes(req.params.userId) ||
          clan.leader.toString() === req.params.userId)
      ) {
        return res.status(401).json({
          msg: "Sub-líderes não podem expulsar outros sub-líderes ou o líder",
        });
      }

      // Verificar se o usuário a ser expulso é membro
      if (!clan.members.includes(req.params.userId)) {
        return res.status(400).json({ msg: "Este usuário não é membro do clã" });
      }

      // Remover da lista de membros e sub-líderes
      clan.members = clan.members.filter(
        (member) => member.toString() !== req.params.userId
      );
      clan.subLeaders = clan.subLeaders.filter(
        (subLeader) => subLeader.toString() !== req.params.userId
      );
      await clan.save();

      // Atualizar o usuário
      await User.findByIdAndUpdate(req.params.userId, {
        clan: null,
        clanRole: null,
      });

      res.json({ msg: "Membro expulso com sucesso" });
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(404).json({ msg: "Clã ou usuário não encontrado" });
      }
      res.status(500).send("Erro no servidor");
    }
  }
);

// @route   DELETE /api/clans/:id
// @desc    Deletar um clã
// @access  Private (apenas líder)
router.delete(
  "/:id",
  [auth, authorizeRole("leader")],
  async (req, res) => {
    try {
      const clan = await Clan.findById(req.params.id);

      if (!clan) {
        return res.status(404).json({ msg: "Clã não encontrado" });
      }

      // O authorizeRole já garante que só o líder pode deletar

      // Remover bandeira se existir
      if (clan.banner) {
        const bannerPath = path.join(__dirname, "..", clan.banner);
        if (fs.existsSync(bannerPath)) {
          fs.unlinkSync(bannerPath);
        }
      }

      // Atualizar todos os membros
      await User.updateMany(
        { clan: clan._id },
        { $set: { clan: null, clanRole: null } }
      );

      // Deletar o clã
      await clan.remove();

      res.json({ msg: "Clã deletado com sucesso" });
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(404).json({ msg: "Clã não encontrado" });
      }
      res.status(500).send("Erro no servidor");
    }
  }
);

// @route   PUT /api/clans/:id/ally/:allyId
// @desc    Adicionar um clã como aliado
// @access  Private (apenas líder)
router.put(
  "/:id/ally/:allyId",
  [auth, authorizeRole("leader")],
  async (req, res) => {
    try {
      const clan = await Clan.findById(req.params.id);
      const allyClan = await Clan.findById(req.params.allyId);

      if (!clan || !allyClan) {
        return res.status(404).json({ msg: "Clã ou clã aliado não encontrado" });
      }

      if (clan.allies.includes(req.params.allyId)) {
        return res.status(400).json({ msg: "Este clã já é seu aliado" });
      }

      // Se for inimigo, remove da lista de inimigos
      if (clan.enemies.includes(req.params.allyId)) {
        clan.enemies = clan.enemies.filter(
          (enemy) => enemy.toString() !== req.params.allyId
        );
      }

      clan.allies.push(req.params.allyId);
      await clan.save();

      res.json({ msg: "Clã adicionado como aliado com sucesso" });
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(404).json({ msg: "Clã ou clã aliado não encontrado" });
      }
      res.status(500).send("Erro no servidor");
    }
  }
);

// @route   PUT /api/clans/:id/enemy/:enemyId
// @desc    Adicionar um clã como inimigo
// @access  Private (apenas líder)
router.put(
  "/:id/enemy/:enemyId",
  [auth, authorizeRole("leader")],
  async (req, res) => {
    try {
      const clan = await Clan.findById(req.params.id);
      const enemyClan = await Clan.findById(req.params.enemyId);

      if (!clan || !enemyClan) {
        return res.status(404).json({ msg: "Clã ou clã inimigo não encontrado" });
      }

      if (clan.enemies.includes(req.params.enemyId)) {
        return res.status(400).json({ msg: "Este clã já é seu inimigo" });
      }

      // Se for aliado, remove da lista de aliados
      if (clan.allies.includes(req.params.enemyId)) {
        clan.allies = clan.allies.filter(
          (ally) => ally.toString() !== req.params.enemyId
        );
      }

      clan.enemies.push(req.params.enemyId);
      await clan.save();

      res.json({ msg: "Clã adicionado como inimigo com sucesso" });
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(404).json({ msg: "Clã ou clã inimigo não encontrado" });
      }
      res.status(500).send("Erro no servidor");
    }
  }
);

module.exports = router;


