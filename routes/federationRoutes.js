const express = require("express");
const router = express.Router();
const Federation = require("../models/Federation");
const Clan = require("../models/Clan");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const { check, validationResult } = require("express-validator");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configuração do Multer para upload de imagens
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

// Middleware para verificar se o usuário é ADM
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "ROLE_ADM") {
    return next();
  }
  return res
    .status(403)
    .json({ msg: "Acesso negado. Permissão de administrador necessária." });
};

// @route   GET /api/federations
// @desc    Obter todas as federações
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const federations = await Federation.find()
      .populate("leader", "username avatar")
      .populate("subLeaders", "username avatar")
      .populate("clans", "name tag");
    res.json(federations);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erro no servidor");
  }
});

// @route   GET /api/federations/:id
// @desc    Obter uma federação específica
// @access  Private
router.get("/:id", auth, async (req, res) => {
  try {
    const federation = await Federation.findById(req.params.id)
      .populate("leader", "username avatar")
      .populate("subLeaders", "username avatar")
      .populate("clans", "name tag leader")
      .populate("allies", "name")
      .populate("enemies", "name");

    if (!federation) {
      return res.status(404).json({ msg: "Federação não encontrada" });
    }

    res.json(federation);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Federação não encontrada" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   POST /api/federations
// @desc    Criar uma nova federação
// @access  Private (apenas ADM)
router.post(
  "/",
  [
    auth,
    isAdmin,
    [check("name", "Nome é obrigatório").not().isEmpty()],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, description } = req.body;

      // Criar nova federação
      const newFederation = new Federation({
        name,
        description,
        leader: req.user.id,
      });

      const federation = await newFederation.save();
      res.json(federation);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Erro no servidor");
    }
  }
);

// @route   PUT /api/federations/:id
// @desc    Atualizar uma federação
// @access  Private (apenas líder ou ADM)
router.put("/:id", auth, async (req, res) => {
  try {
    const federation = await Federation.findById(req.params.id);

    if (!federation) {
      return res.status(404).json({ msg: "Federação não encontrada" });
    }

    // Verificar se o usuário é o líder da federação ou ADM
    if (
      federation.leader.toString() !== req.user.id &&
      req.user.role !== "ROLE_ADM"
    ) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode atualizar a federação" });
    }

    const { name, description, rules } = req.body;

    // Atualizar campos
    if (name) federation.name = name;
    if (description) federation.description = description;
    if (rules) federation.rules = rules;

    await federation.save();
    res.json(federation);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Federação não encontrada" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   PUT /api/federations/:id/banner
// @desc    Atualizar a bandeira da federação
// @access  Private (apenas líder ou ADM)
router.put(
  "/:id/banner",
  [auth, upload.single("banner")],
  async (req, res) => {
    try {
      const federation = await Federation.findById(req.params.id);

      if (!federation) {
        return res.status(404).json({ msg: "Federação não encontrada" });
      }

      // Verificar se o usuário é o líder da federação ou ADM
      if (
        federation.leader.toString() !== req.user.id &&
        req.user.role !== "ROLE_ADM"
      ) {
        return res
          .status(401)
          .json({
            msg: "Apenas o líder pode atualizar a bandeira da federação",
          });
      }

      // Se não houver arquivo, retornar erro
      if (!req.file) {
        return res.status(400).json({ msg: "Nenhum arquivo enviado" });
      }

      // Remover bandeira antiga se existir
      if (federation.banner) {
        const oldPath = path.join(__dirname, "..", federation.banner);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      // Atualizar caminho da bandeira
      federation.banner = req.file.path;
      await federation.save();

      res.json({ banner: federation.banner });
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(404).json({ msg: "Federação não encontrada" });
      }
      res.status(500).send("Erro no servidor");
    }
  }
);

// @route   PUT /api/federations/:id/add-clan/:clanId
// @desc    Adicionar um clã à federação
// @access  Private (apenas líder ou ADM)
router.put("/:id/add-clan/:clanId", auth, async (req, res) => {
  try {
    const federation = await Federation.findById(req.params.id);
    const clan = await Clan.findById(req.params.clanId);

    if (!federation || !clan) {
      return res
        .status(404)
        .json({ msg: "Federação ou clã não encontrado" });
    }

    // Verificar se o usuário é o líder da federação ou ADM
    if (
      federation.leader.toString() !== req.user.id &&
      req.user.role !== "ROLE_ADM"
    ) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode adicionar clãs à federação" });
    }

    // Verificar se o clã já pertence a outra federação
    if (clan.federation) {
      return res
        .status(400)
        .json({
          msg: "Este clã já pertence a uma federação. Saia dela primeiro.",
        });
    }

    // Verificar se o clã já está na federação
    if (federation.clans.includes(req.params.clanId)) {
      return res
        .status(400)
        .json({ msg: "Este clã já pertence a esta federação" });
    }

    // Adicionar clã à federação
    federation.clans.push(req.params.clanId);
    await federation.save();

    // Atualizar o clã
    clan.federation = federation._id;
    await clan.save();

    res.json({ msg: "Clã adicionado à federação com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res
        .status(404)
        .json({ msg: "Federação ou clã não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   PUT /api/federations/:id/remove-clan/:clanId
// @desc    Remover um clã da federação
// @access  Private (apenas líder ou ADM)
router.put("/:id/remove-clan/:clanId", auth, async (req, res) => {
  try {
    const federation = await Federation.findById(req.params.id);
    const clan = await Clan.findById(req.params.clanId);

    if (!federation || !clan) {
      return res
        .status(404)
        .json({ msg: "Federação ou clã não encontrado" });
    }

    // Verificar se o usuário é o líder da federação, líder do clã ou ADM
    if (
      federation.leader.toString() !== req.user.id &&
      clan.leader.toString() !== req.user.id &&
      req.user.role !== "ROLE_ADM"
    ) {
      return res
        .status(401)
        .json({
          msg: "Apenas o líder da federação ou do clã pode remover o clã da federação",
        });
    }

    // Verificar se o clã está na federação
    if (!federation.clans.includes(req.params.clanId)) {
      return res
        .status(400)
        .json({ msg: "Este clã não pertence a esta federação" });
    }

    // Remover clã da federação
    federation.clans = federation.clans.filter(
      (clanId) => clanId.toString() !== req.params.clanId
    );
    await federation.save();

    // Atualizar o clã
    clan.federation = null;
    await clan.save();

    res.json({ msg: "Clã removido da federação com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res
        .status(404)
        .json({ msg: "Federação ou clã não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   PUT /api/federations/:id/promote/:userId
// @desc    Promover um usuário a sub-líder da federação
// @access  Private (apenas líder ou ADM)
router.put("/:id/promote/:userId", auth, async (req, res) => {
  try {
    const federation = await Federation.findById(req.params.id);
    const user = await User.findById(req.params.userId);

    if (!federation || !user) {
      return res
        .status(404)
        .json({ msg: "Federação ou usuário não encontrado" });
    }

    // Verificar se o usuário é o líder da federação ou ADM
    if (
      federation.leader.toString() !== req.user.id &&
      req.user.role !== "ROLE_ADM"
    ) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode promover usuários" });
    }

    // Verificar se o usuário já é sub-líder
    if (federation.subLeaders.includes(req.params.userId)) {
      return res.status(400).json({ msg: "Este usuário já é sub-líder" });
    }

    // Verificar se o usuário é líder de um clã na federação
    const userClan = await Clan.findOne({ leader: req.params.userId });
    if (!userClan || !federation.clans.includes(userClan._id)) {
      return res
        .status(400)
        .json({
          msg: "Apenas líderes de clãs pertencentes à federação podem ser promovidos",
        });
    }

    // Adicionar à lista de sub-líderes
    federation.subLeaders.push(req.params.userId);
    await federation.save();

    // Atualizar o papel do usuário
    user.federationRole = "ROLE_FED_SUBLEADER";
    await user.save();

    res.json({ msg: "Usuário promovido a sub-líder com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res
        .status(404)
        .json({ msg: "Federação ou usuário não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   PUT /api/federations/:id/demote/:userId
// @desc    Rebaixar um sub-líder da federação
// @access  Private (apenas líder ou ADM)
router.put("/:id/demote/:userId", auth, async (req, res) => {
  try {
    const federation = await Federation.findById(req.params.id);
    const user = await User.findById(req.params.userId);

    if (!federation || !user) {
      return res
        .status(404)
        .json({ msg: "Federação ou usuário não encontrado" });
    }

    // Verificar se o usuário é o líder da federação ou ADM
    if (
      federation.leader.toString() !== req.user.id &&
      req.user.role !== "ROLE_ADM"
    ) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode rebaixar sub-líderes" });
    }

    // Verificar se o usuário é sub-líder
    if (!federation.subLeaders.includes(req.params.userId)) {
      return res.status(400).json({ msg: "Este usuário não é sub-líder" });
    }

    // Remover da lista de sub-líderes
    federation.subLeaders = federation.subLeaders.filter(
      (subLeader) => subLeader.toString() !== req.params.userId
    );
    await federation.save();

    // Atualizar o papel do usuário
    user.federationRole = null;
    await user.save();

    res.json({ msg: "Sub-líder rebaixado com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res
        .status(404)
        .json({ msg: "Federação ou usuário não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   PUT /api/federations/:id/transfer/:userId
// @desc    Transferir liderança da federação
// @access  Private (apenas líder ou ADM)
router.put("/:id/transfer/:userId", auth, async (req, res) => {
  try {
    const federation = await Federation.findById(req.params.id);
    const newLeader = await User.findById(req.params.userId);

    if (!federation || !newLeader) {
      return res
        .status(404)
        .json({ msg: "Federação ou usuário não encontrado" });
    }

    // Verificar se o usuário é o líder da federação ou ADM
    if (
      federation.leader.toString() !== req.user.id &&
      req.user.role !== "ROLE_ADM"
    ) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode transferir a liderança" });
    }

    // Verificar se o novo líder é líder de um clã na federação
    const userClan = await Clan.findOne({ leader: req.params.userId });
    if (!userClan || !federation.clans.includes(userClan._id)) {
      return res
        .status(400)
        .json({
          msg: "Apenas líderes de clãs pertencentes à federação podem se tornar líderes",
        });
    }

    // Atualizar líder
    const oldLeaderId = federation.leader;
    federation.leader = req.params.userId;

    // Remover novo líder da lista de sub-líderes se estiver lá
    federation.subLeaders = federation.subLeaders.filter(
      (subLeader) => subLeader.toString() !== req.params.userId
    );

    // Adicionar antigo líder como sub-líder
    if (!federation.subLeaders.includes(oldLeaderId)) {
      federation.subLeaders.push(oldLeaderId);
    }

    await federation.save();

    // Atualizar papéis dos usuários
    newLeader.federationRole = "ROLE_FED_LEADER";
    await newLeader.save();

    const oldLeader = await User.findById(oldLeaderId);
    if (oldLeader) {
      oldLeader.federationRole = "ROLE_FED_SUBLEADER";
      await oldLeader.save();
    }

    res.json({ msg: "Liderança transferida com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res
        .status(404)
        .json({ msg: "Federação ou usuário não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   PUT /api/federations/:id/ally/:allyId
// @desc    Adicionar uma federação como aliada
// @access  Private (apenas líder)
router.put("/:id/ally/:allyId", auth, async (req, res) => {
  try {
    const federation = await Federation.findById(req.params.id);
    const allyFederation = await Federation.findById(req.params.allyId);

    if (!federation || !allyFederation) {
      return res.status(404).json({ msg: "Federação não encontrada" });
    }

    // Verificar se o usuário é o líder da federação
    if (federation.leader.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode adicionar aliados" });
    }

    // Verificar se já é aliada
    if (federation.allies.includes(req.params.allyId)) {
      return res.status(400).json({ msg: "Esta federação já é sua aliada" });
    }

    // Verificar se é inimiga
    if (federation.enemies.includes(req.params.allyId)) {
      // Remover da lista de inimigos
      federation.enemies = federation.enemies.filter(
        (enemy) => enemy.toString() !== req.params.allyId
      );
    }

    // Adicionar à lista de aliados
    federation.allies.push(req.params.allyId);
    await federation.save();

    res.json({ msg: "Federação adicionada como aliada com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Federação não encontrada" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   PUT /api/federations/:id/enemy/:enemyId
// @desc    Adicionar uma federação como inimiga
// @access  Private (apenas líder)
router.put("/:id/enemy/:enemyId", auth, async (req, res) => {
  try {
    const federation = await Federation.findById(req.params.id);
    const enemyFederation = await Federation.findById(req.params.enemyId);

    if (!federation || !enemyFederation) {
      return res.status(404).json({ msg: "Federação não encontrada" });
    }

    // Verificar se o usuário é o líder da federação
    if (federation.leader.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode adicionar inimigos" });
    }

    // Verificar se já é inimiga
    if (federation.enemies.includes(req.params.enemyId)) {
      return res.status(400).json({ msg: "Esta federação já é sua inimiga" });
    }

    // Verificar se é aliada
    if (federation.allies.includes(req.params.enemyId)) {
      // Remover da lista de aliados
      federation.allies = federation.allies.filter(
        (ally) => ally.toString() !== req.params.enemyId
      );
    }

    // Adicionar à lista de inimigos
    federation.enemies.push(req.params.enemyId);
    await federation.save();

    res.json({ msg: "Federação adicionada como inimiga com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Federação não encontrada" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   DELETE /api/federations/:id
// @desc    Deletar uma federação
// @access  Private (apenas líder ou ADM)
router.delete("/:id", auth, async (req, res) => {
  try {
    const federation = await Federation.findById(req.params.id);

    if (!federation) {
      return res.status(404).json({ msg: "Federação não encontrada" });
    }

    // Verificar se o usuário é o líder da federação ou ADM
    if (
      federation.leader.toString() !== req.user.id &&
      req.user.role !== "ROLE_ADM"
    ) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode deletar a federação" });
    }

    // Remover bandeira se existir
    if (federation.banner) {
      const bannerPath = path.join(__dirname, "..", federation.banner);
      if (fs.existsSync(bannerPath)) {
        fs.unlinkSync(bannerPath);
      }
    }

    // Atualizar todos os clãs
    await Clan.updateMany(
      { federation: federation._id },
      { $set: { federation: null } }
    );

    // Atualizar todos os usuários
    await User.updateMany(
      { federationRole: { $in: ["ROLE_FED_LEADER", "ROLE_FED_SUBLEADER"] } },
      { $set: { federationRole: null } }
    );

    // Deletar a federação
    await federation.remove();

    res.json({ msg: "Federação deletada com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Federação não encontrada" });
    }
    res.status(500).send("Erro no servidor");
  }
});

module.exports = router;

