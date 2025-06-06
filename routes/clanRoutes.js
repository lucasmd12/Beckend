const express = require("express");
const router = express.Router();
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
// @access  Private
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
router.put("/:id", auth, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // Verificar se o usuário é o líder do clã
    if (clan.leader.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode atualizar o clã" });
    }

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
  [auth, upload.single("banner")],
  async (req, res) => {
    try {
      const clan = await Clan.findById(req.params.id);

      if (!clan) {
        return res.status(404).json({ msg: "Clã não encontrado" });
      }

      // Verificar se o usuário é o líder do clã
      if (clan.leader.toString() !== req.user.id) {
        return res
          .status(401)
          .json({ msg: "Apenas o líder pode atualizar a bandeira do clã" });
      }

      // Se não houver arquivo, retornar erro
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

    // Verificar se o usuário já tem um clã
    const user = await User.findById(req.user.id);
    if (user.clan) {
      return res
        .status(400)
        .json({ msg: "Você já pertence a um clã. Saia dele primeiro." });
    }

    // Verificar se o usuário já é membro
    if (clan.members.includes(req.user.id)) {
      return res.status(400).json({ msg: "Você já é membro deste clã" });
    }

    // Adicionar usuário à lista de membros
    clan.members.push(req.user.id);
    await clan.save();

    // Atualizar o usuário com o ID do clã e papel de membro
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

    // Verificar se o usuário é o líder
    if (clan.leader.toString() === req.user.id) {
      return res
        .status(400)
        .json({
          msg: "Líderes não podem sair do clã. Transfira a liderança primeiro ou delete o clã.",
        });
    }

    // Verificar se o usuário é membro
    if (!clan.members.includes(req.user.id)) {
      return res.status(400).json({ msg: "Você não é membro deste clã" });
    }

    // Remover usuário da lista de membros e sub-líderes
    clan.members = clan.members.filter(
      (member) => member.toString() !== req.user.id
    );
    clan.subLeaders = clan.subLeaders.filter(
      (subLeader) => subLeader.toString() !== req.user.id
    );
    await clan.save();

    // Atualizar o usuário
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
router.put("/:id/promote/:userId", auth, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // Verificar se o usuário é o líder do clã
    if (clan.leader.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode promover membros" });
    }

    // Verificar se o usuário a ser promovido existe e é membro
    if (!clan.members.includes(req.params.userId)) {
      return res.status(400).json({ msg: "Este usuário não é membro do clã" });
    }

    // Verificar se o usuário já é sub-líder
    if (clan.subLeaders.includes(req.params.userId)) {
      return res.status(400).json({ msg: "Este usuário já é sub-líder" });
    }

    // Adicionar à lista de sub-líderes
    clan.subLeaders.push(req.params.userId);
    await clan.save();

    // Atualizar o papel do usuário
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
router.put("/:id/demote/:userId", auth, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // Verificar se o usuário é o líder do clã
    if (clan.leader.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode rebaixar sub-líderes" });
    }

    // Verificar se o usuário a ser rebaixado é sub-líder
    if (!clan.subLeaders.includes(req.params.userId)) {
      return res.status(400).json({ msg: "Este usuário não é sub-líder" });
    }

    // Remover da lista de sub-líderes
    clan.subLeaders = clan.subLeaders.filter(
      (subLeader) => subLeader.toString() !== req.params.userId
    );
    await clan.save();

    // Atualizar o papel do usuário
    await User.findByIdAndUpdate(req.params.userId, {
      clanRole: "member",
    });

    res.json({ msg: "Sub-líder rebaixado a membro comum com sucesso" });
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
router.put("/:id/transfer/:userId", auth, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // Verificar se o usuário é o líder do clã
    if (clan.leader.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode transferir a liderança" });
    }

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
});

// @route   PUT /api/clans/:id/kick/:userId
// @desc    Expulsar um membro do clã
// @access  Private (líder e sub-líderes)
router.put("/:id/kick/:userId", auth, async (req, res) => {
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
      return res
        .status(401)
        .json({
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
});

// @route   DELETE /api/clans/:id
// @desc    Deletar um clã
// @access  Private (apenas líder)
router.delete("/:id", auth, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // Verificar se o usuário é o líder do clã
    if (clan.leader.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Apenas o líder pode deletar o clã" });
    }

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
});

// @route   PUT /api/clans/:id/ally/:allyId
// @desc    Adicionar um clã como aliado
// @access  Private (apenas líder)
router.put("/:id/ally/:allyId", auth, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);
    const allyClan = await Clan.findById(req.params.allyId);

    if (!clan || !allyClan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // Verificar se o usuário é o líder do clã
    if (clan.leader.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode adicionar aliados" });
    }

    // Verificar se já é aliado
    if (clan.allies.includes(req.params.allyId)) {
      return res.status(400).json({ msg: "Este clã já é seu aliado" });
    }

    // Verificar se é inimigo
    if (clan.enemies.includes(req.params.allyId)) {
      // Remover da lista de inimigos
      clan.enemies = clan.enemies.filter(
        (enemy) => enemy.toString() !== req.params.allyId
      );
    }

    // Adicionar à lista de aliados
    clan.allies.push(req.params.allyId);
    await clan.save();

    res.json({ msg: "Clã adicionado como aliado com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   PUT /api/clans/:id/enemy/:enemyId
// @desc    Adicionar um clã como inimigo
// @access  Private (apenas líder)
router.put("/:id/enemy/:enemyId", auth, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);
    const enemyClan = await Clan.findById(req.params.enemyId);

    if (!clan || !enemyClan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // Verificar se o usuário é o líder do clã
    if (clan.leader.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode adicionar inimigos" });
    }

    // Verificar se já é inimigo
    if (clan.enemies.includes(req.params.enemyId)) {
      return res.status(400).json({ msg: "Este clã já é seu inimigo" });
    }

    // Verificar se é aliado
    if (clan.allies.includes(req.params.enemyId)) {
      // Remover da lista de aliados
      clan.allies = clan.allies.filter(
        (ally) => ally.toString() !== req.params.enemyId
      );
    }

    // Adicionar à lista de inimigos
    clan.enemies.push(req.params.enemyId);
    await clan.save();

    res.json({ msg: "Clã adicionado como inimigo com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   PUT /api/clans/:id/remove-ally/:allyId
// @desc    Remover um clã da lista de aliados
// @access  Private (apenas líder)
router.put("/:id/remove-ally/:allyId", auth, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // Verificar se o usuário é o líder do clã
    if (clan.leader.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode remover aliados" });
    }

    // Verificar se é aliado
    if (!clan.allies.includes(req.params.allyId)) {
      return res.status(400).json({ msg: "Este clã não é seu aliado" });
    }

    // Remover da lista de aliados
    clan.allies = clan.allies.filter(
      (ally) => ally.toString() !== req.params.allyId
    );
    await clan.save();

    res.json({ msg: "Clã removido da lista de aliados com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   PUT /api/clans/:id/remove-enemy/:enemyId
// @desc    Remover um clã da lista de inimigos
// @access  Private (apenas líder)
router.put("/:id/remove-enemy/:enemyId", auth, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // Verificar se o usuário é o líder do clã
    if (clan.leader.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode remover inimigos" });
    }

    // Verificar se é inimigo
    if (!clan.enemies.includes(req.params.enemyId)) {
      return res.status(400).json({ msg: "Este clã não é seu inimigo" });
    }

    // Remover da lista de inimigos
    clan.enemies = clan.enemies.filter(
      (enemy) => enemy.toString() !== req.params.enemyId
    );
    await clan.save();

    res.json({ msg: "Clã removido da lista de inimigos com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   POST /api/clans/:id/roles
// @desc    Criar um novo cargo personalizado
// @access  Private (apenas líder)
router.post(
  "/:id/roles",
  [
    auth,
    [
      check("name", "Nome do cargo é obrigatório").not().isEmpty(),
      check("color", "Cor do cargo é obrigatória").not().isEmpty(),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const clan = await Clan.findById(req.params.id);

      if (!clan) {
        return res.status(404).json({ msg: "Clã não encontrado" });
      }

      // Verificar se o usuário é o líder do clã
      if (clan.leader.toString() !== req.user.id) {
        return res
          .status(401)
          .json({ msg: "Apenas o líder pode criar cargos" });
      }

      const { name, color, permissions } = req.body;

      // Criar novo cargo
      const newRole = {
        name,
        color,
        permissions: permissions || {
          manageMembers: false,
          manageChannels: false,
          manageRoles: false,
          kickMembers: false,
          muteMembers: false,
        },
      };

      clan.customRoles.push(newRole);
      await clan.save();

      res.json(clan.customRoles[clan.customRoles.length - 1]);
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(404).json({ msg: "Clã não encontrado" });
      }
      res.status(500).send("Erro no servidor");
    }
  }
);

// @route   PUT /api/clans/:id/roles/:roleIndex
// @desc    Atualizar um cargo personalizado
// @access  Private (apenas líder)
router.put(
  "/:id/roles/:roleIndex",
  [
    auth,
    [
      check("name", "Nome do cargo é obrigatório").not().isEmpty(),
      check("color", "Cor do cargo é obrigatória").not().isEmpty(),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const clan = await Clan.findById(req.params.id);

      if (!clan) {
        return res.status(404).json({ msg: "Clã não encontrado" });
      }

      // Verificar se o usuário é o líder do clã
      if (clan.leader.toString() !== req.user.id) {
        return res
          .status(401)
          .json({ msg: "Apenas o líder pode atualizar cargos" });
      }

      const roleIndex = parseInt(req.params.roleIndex);
      if (
        isNaN(roleIndex) ||
        roleIndex < 0 ||
        roleIndex >= clan.customRoles.length
      ) {
        return res.status(404).json({ msg: "Cargo não encontrado" });
      }

      const { name, color, permissions } = req.body;

      // Atualizar cargo
      clan.customRoles[roleIndex] = {
        name,
        color,
        permissions: permissions || clan.customRoles[roleIndex].permissions,
      };

      await clan.save();
      res.json(clan.customRoles[roleIndex]);
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(404).json({ msg: "Clã não encontrado" });
      }
      res.status(500).send("Erro no servidor");
    }
  }
);

// @route   DELETE /api/clans/:id/roles/:roleIndex
// @desc    Deletar um cargo personalizado
// @access  Private (apenas líder)
router.delete("/:id/roles/:roleIndex", auth, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // Verificar se o usuário é o líder do clã
    if (clan.leader.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode deletar cargos" });
    }

    const roleIndex = parseInt(req.params.roleIndex);
    if (
      isNaN(roleIndex) ||
      roleIndex < 0 ||
      roleIndex >= clan.customRoles.length
    ) {
      return res.status(404).json({ msg: "Cargo não encontrado" });
    }

    // Remover cargo
    const roleName = clan.customRoles[roleIndex].name;
    clan.customRoles.splice(roleIndex, 1);

    // Remover atribuições deste cargo
    clan.memberRoles = clan.memberRoles.filter(
      (memberRole) => memberRole.role !== roleName
    );

    await clan.save();
    res.json({ msg: "Cargo deletado com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

// @route   PUT /api/clans/:id/assign-role/:userId
// @desc    Atribuir um cargo a um membro
// @access  Private (apenas líder)
router.put(
  "/:id/assign-role/:userId",
  [auth, [check("role", "Nome do cargo é obrigatório").not().isEmpty()]],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const clan = await Clan.findById(req.params.id);

      if (!clan) {
        return res.status(404).json({ msg: "Clã não encontrado" });
      }

      // Verificar se o usuário é o líder do clã
      if (clan.leader.toString() !== req.user.id) {
        return res
          .status(401)
          .json({ msg: "Apenas o líder pode atribuir cargos" });
      }

      // Verificar se o usuário é membro
      if (!clan.members.includes(req.params.userId)) {
        return res.status(400).json({ msg: "Este usuário não é membro do clã" });
      }

      const { role } = req.body;

      // Verificar se o cargo existe
      const roleExists = clan.customRoles.some((r) => r.name === role);
      if (!roleExists) {
        return res.status(404).json({ msg: "Cargo não encontrado" });
      }

      // Verificar se o usuário já tem este cargo
      const memberRoleIndex = clan.memberRoles.findIndex(
        (mr) => mr.user.toString() === req.params.userId
      );

      if (memberRoleIndex !== -1) {
        // Atualizar cargo existente
        clan.memberRoles[memberRoleIndex].role = role;
      } else {
        // Adicionar novo cargo
        clan.memberRoles.push({
          user: req.params.userId,
          role,
        });
      }

      await clan.save();
      res.json({ msg: "Cargo atribuído com sucesso" });
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(404).json({ msg: "Clã ou usuário não encontrado" });
      }
      res.status(500).send("Erro no servidor");
    }
  }
);

// @route   DELETE /api/clans/:id/remove-role/:userId
// @desc    Remover o cargo de um membro
// @access  Private (apenas líder)
router.delete("/:id/remove-role/:userId", auth, async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // Verificar se o usuário é o líder do clã
    if (clan.leader.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ msg: "Apenas o líder pode remover cargos" });
    }

    // Verificar se o usuário é membro
    if (!clan.members.includes(req.params.userId)) {
      return res.status(400).json({ msg: "Este usuário não é membro do clã" });
    }

    // Remover cargo
    clan.memberRoles = clan.memberRoles.filter(
      (memberRole) => memberRole.user.toString() !== req.params.userId
    );

    await clan.save();
    res.json({ msg: "Cargo removido com sucesso" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Clã ou usuário não encontrado" });
    }
    res.status(500).send("Erro no servidor");
  }
});

module.exports = router;

