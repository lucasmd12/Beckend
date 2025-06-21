const Federation = require("../models/Federation");
const Clan = require("../models/Clan");
const User = require("../models/User");

// @desc    Get all federations
// @route   GET /api/federations
// @access  Private
exports.getFederations = async (req, res) => {
  try {
    const federations = await Federation.find()
      .populate("leader", "username avatar")
      .populate("subLeaders", "username avatar")
      .populate("clans", "name tag");
    res.json({ success: true, data: federations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Get single federation by ID
// @route   GET /api/federations/:id
// @access  Private
exports.getFederationById = async (req, res) => {
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
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Create a new federation
// @route   POST /api/federations
// @access  Private (ADM only)
exports.createFederation = async (req, res) => {
  try {
    const { name, description } = req.body;
    const newFederation = new Federation({
      name,
      description,
      leader: req.user.id, // O usuário logado é o líder
    });
    const federation = await newFederation.save();
    res.status(201).json({ success: true, data: federation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Update federation details
// @route   PUT /api/federations/:id
// @access  Private (Federation Leader or ADM)
exports.updateFederation = async (req, res) => {
  try {
    const federation = req.federation; // From authorizeFederationLeaderOrADM middleware
    const { name, description, rules } = req.body;

    if (name) federation.name = name;
    if (description) federation.description = description;
    if (rules) federation.rules = rules;

    await federation.save();
    res.json({ success: true, data: federation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Update federation banner
// @route   PUT /api/federations/:id/banner
// @access  Private (Federation Leader or ADM)
exports.updateFederationBanner = async (req, res) => {
  try {
    const federation = req.federation; // From authorizeFederationLeaderOrADM middleware
    if (!req.file) return res.status(400).json({ msg: "Nenhum arquivo enviado" });

    // TODO: Implementar exclusão do banner antigo se existir
    federation.banner = req.file.path; // Caminho do arquivo salvo pelo Multer
    await federation.save();
    res.json({ success: true, banner: federation.banner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Add clan to federation
// @route   PUT /api/federations/:id/add-clan/:clanId
// @access  Private (Federation Leader or ADM)
exports.addClanToFederation = async (req, res) => {
  try {
    const federation = req.federation; // From authorizeFederationLeaderOrADM middleware
    const clan = await Clan.findById(req.params.clanId);

    if (!clan) return res.status(404).json({ msg: "Clã não encontrado" });
    if (clan.federation) return res.status(400).json({ msg: "Este clã já pertence a uma federação." });
    if (federation.clans.includes(req.params.clanId)) return res.status(400).json({ msg: "Clã já está nesta federação." });

    federation.clans.push(req.params.clanId);
    await federation.save();

    clan.federation = federation._id; // Vincular o clã à federação
    await clan.save();

    res.json({ success: true, msg: "Clã adicionado à federação com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Remove clan from federation
// @route   PUT /api/federations/:id/remove-clan/:clanId
// @access  Private (Federation Leader or ADM)
exports.removeClanFromFederation = async (req, res) => {
  try {
    const federation = req.federation; // From authorizeFederationLeaderOrADM middleware
    const clan = await Clan.findById(req.params.clanId);

    if (!clan) return res.status(404).json({ msg: "Clã não encontrado" });
    if (!federation.clans.includes(req.params.clanId)) return res.status(400).json({ msg: "Clã não pertence a esta federação." });

    federation.clans = federation.clans.filter(c => c.toString() !== req.params.clanId);
    await federation.save();

    clan.federation = null; // Desvincular o clã da federação
    await clan.save();

    res.json({ success: true, msg: "Clã removido da federação com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Promote user to sub-leader of federation
// @route   PUT /api/federations/:id/promote-subleader/:userId
// @access  Private (Federation Leader or ADM)
exports.promoteSubLeader = async (req, res) => {
  try {
    const federation = req.federation; // From authorizeFederationLeaderOrADM middleware
    const user = await User.findById(req.params.userId);

    if (!user) return res.status(404).json({ msg: "Usuário não encontrado" });
    if (federation.subLeaders.includes(req.params.userId)) return res.status(400).json({ msg: "Usuário já é sub-líder da federação." });

    federation.subLeaders.push(req.params.userId);
    await federation.save();

    user.federationRole = "subleader"; // Atualizar o papel do usuário
    await user.save();

    res.json({ success: true, msg: "Usuário promovido a sub-líder da federação com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Demote sub-leader of federation
// @route   PUT /api/federations/:id/demote-subleader/:userId
// @access  Private (Federation Leader or ADM)
exports.demoteSubLeader = async (req, res) => {
  try {
    const federation = req.federation; // From authorizeFederationLeaderOrADM middleware
    const user = await User.findById(req.params.userId);

    if (!user) return res.status(404).json({ msg: "Usuário não encontrado" });
    if (!federation.subLeaders.includes(req.params.userId)) return res.status(400).json({ msg: "Usuário não é sub-líder da federação." });

    federation.subLeaders = federation.subLeaders.filter(sl => sl.toString() !== req.params.userId);
    await federation.save();

    user.federationRole = "member"; // Reverter o papel do usuário
    await user.save();

    res.json({ success: true, msg: "Usuário rebaixado de sub-líder da federação com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Add ally federation
// @route   PUT /api/federations/:id/add-ally/:allyId
// @access  Private (Federation Leader or ADM)
exports.addAlly = async (req, res) => {
  try {
    const federation = req.federation; // From authorizeFederationLeaderOrADM middleware
    const allyFederation = await Federation.findById(req.params.allyId);

    if (!allyFederation) return res.status(404).json({ msg: "Federação aliada não encontrada" });
    if (federation.allies.includes(req.params.allyId)) return res.status(400).json({ msg: "Esta federação já é sua aliada." });

    federation.allies.push(req.params.allyId);
    await federation.save();

    res.json({ success: true, msg: "Federação adicionada como aliada com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Remove ally federation
// @route   PUT /api/federations/:id/remove-ally/:allyId
// @access  Private (Federation Leader or ADM)
exports.removeAlly = async (req, res) => {
  try {
    const federation = req.federation; // From authorizeFederationLeaderOrADM middleware

    if (!federation.allies.includes(req.params.allyId)) return res.status(400).json({ msg: "Esta federação não é sua aliada." });

    federation.allies = federation.allies.filter(a => a.toString() !== req.params.allyId);
    await federation.save();

    res.json({ success: true, msg: "Federação removida como aliada com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Add enemy federation
// @route   PUT /api/federations/:id/add-enemy/:enemyId
// @access  Private (Federation Leader or ADM)
exports.addEnemy = async (req, res) => {
  try {
    const federation = req.federation; // From authorizeFederationLeaderOrADM middleware
    const enemyFederation = await Federation.findById(req.params.enemyId);

    if (!enemyFederation) return res.status(404).json({ msg: "Federação inimiga não encontrada" });
    if (federation.enemies.includes(req.params.enemyId)) return res.status(400).json({ msg: "Esta federação já é sua inimiga." });

    federation.enemies.push(req.params.enemyId);
    await federation.save();

    res.json({ success: true, msg: "Federação adicionada como inimiga com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Remove enemy federation
// @route   PUT /api/federations/:id/remove-enemy/:enemyId
// @access  Private (Federation Leader or ADM)
exports.removeEnemy = async (req, res) => {
  try {
    const federation = req.federation; // From authorizeFederationLeaderOrADM middleware

    if (!federation.enemies.includes(req.params.enemyId)) return res.status(400).json({ msg: "Esta federação não é sua inimiga." });

    federation.enemies = federation.enemies.filter(e => e.toString() !== req.params.enemyId);
    await federation.save();

    res.json({ success: true, msg: "Federação removida como inimiga com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Delete a federation
// @route   DELETE /api/federations/:id
// @access  Private (Federation Leader or ADM)
exports.deleteFederation = async (req, res) => {
  try {
    const federation = req.federation; // From authorizeFederationLeaderOrADM middleware

    // TODO: Implementar exclusão do banner se existir

    // Desvincular clãs da federação
    await Clan.updateMany(
      { federation: federation._id },
      { $set: { federation: null } }
    );

    // Reverter o papel de usuários que eram líderes/sub-líderes da federação
    await User.updateMany(
      { federation: federation._id },
      { $set: { federation: null, federationRole: null } }
    );

    await federation.deleteOne();
    res.json({ success: true, msg: "Federação deletada com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};


