const Clan = require("../models/Clan");
const User = require("../models/User");
const Federation = require("../models/Federation");

// @desc    Get all clans
// @route   GET /api/clans
// @access  Private
exports.getClans = async (req, res) => {
  try {
    const clans = await Clan.find({})
      .populate("leader", "username avatar")
      .populate("subLeaders", "username avatar")
      .populate("members", "username avatar")
      .populate("federation", "name");
    res.json(clans);
  } catch (error) {
    console.error("Erro ao obter clãs:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Get a specific clan by ID
// @route   GET /api/clans/:id
// @access  Private
exports.getClanById = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id)
      .populate("leader", "username avatar")
      .populate("subLeaders", "username avatar")
      .populate("members", "username avatar")
      .populate("federation", "name");

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }
    res.json(clan);
  } catch (error) {
    console.error("Erro ao obter clã:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Create a new clan
// @route   POST /api/clans
// @access  Private
exports.createClan = async (req, res) => {
  const { name, tag, description } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (user.clan) {
      return res.status(400).json({ msg: "Você já pertence a um clã." });
    }

    let clan = await Clan.findOne({ tag: tag.toUpperCase() });
    if (clan) {
      return res.status(400).json({ msg: "Esta tag já está em uso." });
    }

    clan = new Clan({
      name,
      tag: tag.toUpperCase(),
      description,
      leader: req.user.id,
      members: [req.user.id],
    });

    await clan.save();

    user.clan = clan._id;
    user.clanRole = "Leader";
    await user.save();

    res.status(201).json({ msg: "Clã criado com sucesso!", data: clan });
  } catch (error) {
    console.error("Erro ao criar clã:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Update clan information
// @route   PUT /api/clans/:id
// @access  Private (Clan Leader or ADM)
exports.updateClan = async (req, res) => {
  const { name, description, rules } = req.body;
  const clan = req.clan; // Obtained from middleware

  try {
    if (name) clan.name = name;
    if (description) clan.description = description;
    if (rules) clan.rules = rules;

    await clan.save();
    res.json({ success: true, data: clan });
  } catch (error) {
    console.error("Erro ao atualizar clã:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Update clan banner
// @route   PUT /api/clans/:id/banner
// @access  Private (Clan Leader or ADM)
exports.updateClanBanner = async (req, res) => {
  const clan = req.clan; // Obtained from middleware

  try {
    if (!req.file) {
      return res.status(400).json({ msg: "Nenhum arquivo enviado" });
    }

    // TODO: Implementar exclusão do banner antigo se existir

    clan.banner = req.file.path; // Path of the file saved by Multer
    await clan.save();

    res.json({ success: true, banner: clan.banner });
  } catch (error) {
    console.error("Erro ao atualizar banner do clã:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Join a clan
// @route   PUT /api/clans/:id/join
// @access  Private
exports.joinClan = async (req, res) => {
  const { id } = req.params;

  try {
    const clan = await Clan.findById(id);
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado." });
    }

    const user = await User.findById(req.user.id);
    if (user.clan) {
      return res.status(400).json({ msg: "Você já pertence a um clã." });
    }

    if (clan.members.includes(req.user.id)) {
      return res.status(400).json({ msg: "Você já é membro deste clã." });
    }

    clan.members.push(req.user.id);
    await clan.save();

    user.clan = clan._id;
    user.clanRole = "member";
    await user.save();

    res.json({ success: true, msg: "Entrou no clã com sucesso!" });
  } catch (error) {
    console.error("Erro ao entrar no clã:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Leave a clan
// @route   PUT /api/clans/:id/leave
// @access  Private
exports.leaveClan = async (req, res) => {
  const { id } = req.params;

  try {
    const clan = await Clan.findById(id);
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado." });
    }

    const user = await User.findById(req.user.id);

    if (!clan.members.includes(req.user.id)) {
      return res.status(400).json({ msg: "Você não é membro deste clã." });
    }

    if (clan.leader.toString() === req.user.id) {
      return res.status(400).json({ msg: "Líder não pode sair do clã sem transferir a liderança primeiro." });
    }

    clan.members = clan.members.filter(member => member.toString() !== req.user.id);
    if (clan.subLeaders.includes(req.user.id)) {
      clan.subLeaders = clan.subLeaders.filter(subLeader => subLeader.toString() !== req.user.id);
    }
    await clan.save();

    user.clan = null;
    user.clanRole = null;
    await user.save();

    res.json({ success: true, msg: "Saiu do clã com sucesso!" });
  } catch (error) {
    console.error("Erro ao sair do clã:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Promote a member to sub-leader
// @route   PUT /api/clans/:id/promote/:userId
// @access  Private (Clan Leader or ADM)
exports.promoteMember = async (req, res) => {
  const { userId } = req.params;
  const clan = req.clan; // Obtained from middleware

  try {
    const userToPromote = await User.findById(userId);
    if (!userToPromote) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    if (!clan.members.includes(userId)) {
      return res.status(400).json({ msg: "Usuário não é membro deste clã." });
    }

    if (userToPromote.clanRole === "Leader" || userToPromote.clanRole === "SubLeader") {
      return res.status(400).json({ msg: "Usuário já é líder ou sub-líder." });
    }

    clan.subLeaders.push(userId);
    await clan.save();

    userToPromote.clanRole = "SubLeader";
    await userToPromote.save();

    res.json({ success: true, msg: "Membro promovido a sub-líder com sucesso!" });
  } catch (error) {
    console.error("Erro ao promover membro:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Demote a sub-leader to a regular member
// @route   PUT /api/clans/:id/demote/:userId
// @access  Private (Clan Leader or ADM)
exports.demoteMember = async (req, res) => {
  const { userId } = req.params;
  const clan = req.clan; // Obtained from middleware

  try {
    const userToDemote = await User.findById(userId);
    if (!userToDemote) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    if (userToDemote.clanRole !== "SubLeader") {
      return res.status(400).json({ msg: "Usuário não é sub-líder." });
    }

    clan.subLeaders = clan.subLeaders.filter(subLeader => subLeader.toString() !== userId);
    await clan.save();

    userToDemote.clanRole = "member";
    await userToDemote.save();

    res.json({ success: true, msg: "Sub-líder rebaixado a membro comum com sucesso!" });
  } catch (error) {
    console.error("Erro ao rebaixar membro:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Transfer clan leadership
// @route   PUT /api/clans/:id/transfer/:userId
// @access  Private (Clan Leader or ADM)
exports.transferLeadership = async (req, res) => {
  const { userId } = req.params;
  const clan = req.clan; // Obtained from middleware

  try {
    const newLeader = await User.findById(userId);
    if (!newLeader) {
      return res.status(404).json({ msg: "Novo líder não encontrado." });
    }

    if (!clan.members.includes(userId)) {
      return res.status(400).json({ msg: "O novo líder deve ser um membro do clã." });
    }

    const oldLeader = await User.findById(clan.leader);
    if (oldLeader) {
      oldLeader.clanRole = "member";
      await oldLeader.save();
    }

    newLeader.clanRole = "Leader";
    await newLeader.save();

    clan.leader = userId;
    clan.subLeaders = clan.subLeaders.filter(subLeader => subLeader.toString() !== userId);
    await clan.save();

    res.json({ success: true, msg: "Liderança do clã transferida com sucesso!" });
  } catch (error) {
    console.error("Erro ao transferir liderança:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Kick a member from the clan
// @route   PUT /api/clans/:id/kick/:userId
// @access  Private (Clan Leader or Sub-leader or ADM)
exports.kickMember = async (req, res) => {
  const { userId } = req.params;
  const clan = req.clan; // Obtained from middleware

  try {
    const userToKick = await User.findById(userId);
    if (!userToKick) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    if (!clan.members.includes(userId)) {
      return res.status(400).json({ msg: "Usuário não é membro deste clã." });
    }

    if (clan.leader.toString() === userId) {
      return res.status(400).json({ msg: "Não é possível expulsar o líder do clã." });
    }

    clan.members = clan.members.filter(member => member.toString() !== userId);
    if (clan.subLeaders.includes(userId)) {
      clan.subLeaders = clan.subLeaders.filter(subLeader => subLeader.toString() !== userId);
    }
    await clan.save();

    userToKick.clan = null;
    userToKick.clanRole = null;
    await userToKick.save();

    res.json({ success: true, msg: "Membro expulso do clã com sucesso!" });
  } catch (error) {
    console.error("Erro ao expulsar membro:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Delete a clan
// @route   DELETE /api/clans/:id
// @access  Private (Clan Leader or ADM)
exports.deleteClan = async (req, res) => {
  const clan = req.clan; // Obtained from middleware

  try {
    await User.updateMany({ clan: clan._id }, { $set: { clan: null, clanRole: null } });

    if (clan.federation) {
      const federation = await Federation.findById(clan.federation);
      if (federation) {
        federation.clans = federation.clans.filter(c => c.toString() !== clan._id.toString());
        await federation.save();
      }
    }

    await clan.deleteOne();

    res.json({ success: true, msg: "Clã deletado com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar clã:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Add an allied clan
// @route   PUT /api/clans/:id/ally/:allyId
// @access  Private (Clan Leader or ADM)
exports.addAlly = async (req, res) => {
  const { allyId } = req.params;
  const clan = req.clan; // Obtained from middleware

  try {
    const allyClan = await Clan.findById(allyId);
    if (!allyClan) {
      return res.status(404).json({ msg: "Clã aliado não encontrado." });
    }

    if (clan.allies.includes(allyId)) {
      return res.status(400).json({ msg: "Este clã já é seu aliado." });
    }

    clan.allies.push(allyId);
    await clan.save();

    res.json({ success: true, msg: "Clã adicionado como aliado com sucesso!" });
  } catch (error) {
    console.error("Erro ao adicionar aliado:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Remove an allied clan
// @route   PUT /api/clans/:id/remove-ally/:allyId
// @access  Private (Clan Leader or ADM)
exports.removeAlly = async (req, res) => {
  const { allyId } = req.params;
  const clan = req.clan; // Obtained from middleware

  try {
    if (!clan.allies.includes(allyId)) {
      return res.status(400).json({ msg: "Este clã não é seu aliado." });
    }

    clan.allies = clan.allies.filter(ally => ally.toString() !== allyId);
    await clan.save();

    res.json({ success: true, msg: "Clã removido como aliado com sucesso!" });
  } catch (error) {
    console.error("Erro ao remover aliado:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Add an enemy clan
// @route   PUT /api/clans/:id/enemy/:enemyId
// @access  Private (Clan Leader or ADM)
exports.addEnemy = async (req, res) => {
  const { enemyId } = req.params;
  const clan = req.clan; // Obtained from middleware

  try {
    const enemyClan = await Clan.findById(enemyId);
    if (!enemyClan) {
      return res.status(404).json({ msg: "Clã inimigo não encontrado." });
    }

    if (clan.enemies.includes(enemyId)) {
      return res.status(400).json({ msg: "Este clã já é seu inimigo." });
    }

    clan.enemies.push(enemyId);
    await clan.save();

    res.json({ success: true, msg: "Clã adicionado como inimigo com sucesso!" });
  } catch (error) {
    console.error("Erro ao adicionar inimigo:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Remove an enemy clan
// @route   PUT /api/clans/:id/remove-enemy/:enemyId
// @access  Private (Clan Leader or ADM)
exports.removeEnemy = async (req, res) => {
  const { enemyId } = req.params;
  const clan = req.clan; // Obtained from middleware

  try {
    if (!clan.enemies.includes(enemyId)) {
      return res.status(400).json({ msg: "Este clã não é seu inimigo." });
    }

    clan.enemies = clan.enemies.filter(enemy => enemy.toString() !== enemyId);
    await clan.save();

    res.json({ success: true, msg: "Clã removido como inimigo com sucesso!" });
  } catch (error) {
    console.error("Erro ao remover inimigo:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Get clans by federation ID
// @route   GET /api/clans/federation/:federationId
// @access  Private
exports.getClansByFederation = async (req, res) => {
  try {
    const { federationId } = req.params;
    const clans = await Clan.find({ federation: federationId })
      .populate("leader", "username avatar")
      .populate("subLeaders", "username avatar")
      .populate("members", "username avatar");
    res.json({ success: true, data: clans });
  } catch (error) {
    console.error("Erro ao obter clãs por federação:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// @desc    Add a custom role to a clan
// @route   POST /api/clans/:id/roles
// @access  Private (Clan Leader or ADM)
exports.addCustomRole = async (req, res) => {
  const { name, color, permissions } = req.body;
  const clan = req.clan; // Obtained from middleware

  try {
    if (clan.customRoles.some(role => role.name === name)) {
      return res.status(400).json({ msg: "Um cargo com este nome já existe." });
    }

    clan.customRoles.push({ name, color, permissions });
    await clan.save();

    res.status(201).json({ success: true, msg: "Cargo customizado adicionado com sucesso!", data: clan.customRoles });
  } catch (error) {
    console.error("Erro ao adicionar cargo customizado:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Update a custom role in a clan
// @route   PUT /api/clans/:id/roles/:roleName
// @access  Private (Clan Leader or ADM)
exports.updateCustomRole = async (req, res) => {
  const { roleName } = req.params;
  const { name, color, permissions } = req.body;
  const clan = req.clan; // Obtained from middleware

  try {
    const roleIndex = clan.customRoles.findIndex(role => role.name === roleName);

    if (roleIndex === -1) {
      return res.status(404).json({ msg: "Cargo customizado não encontrado." });
    }

    if (name) clan.customRoles[roleIndex].name = name;
    if (color) clan.customRoles[roleIndex].color = color;
    if (permissions) clan.customRoles[roleIndex].permissions = { ...clan.customRoles[roleIndex].permissions, ...permissions };

    await clan.save();

    res.json({ success: true, msg: "Cargo customizado atualizado com sucesso!", data: clan.customRoles[roleIndex] });
  } catch (error) {
    console.error("Erro ao atualizar cargo customizado:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Delete a custom role from a clan
// @route   DELETE /api/clans/:id/roles/:roleName
// @access  Private (Clan Leader or ADM)
exports.deleteCustomRole = async (req, res) => {
  const { roleName } = req.params;
  const clan = req.clan; // Obtained from middleware

  try {
    const initialLength = clan.customRoles.length;
    clan.customRoles = clan.customRoles.filter(role => role.name !== roleName);

    if (clan.customRoles.length === initialLength) {
      return res.status(404).json({ msg: "Cargo customizado não encontrado." });
    }

    // Remover o cargo de todos os membros que o possuíam
    clan.memberRoles = clan.memberRoles.filter(mr => mr.roleName !== roleName);
    await clan.save();

    // Opcional: Atualizar o User.clanRole para null ou um padrão se o cargo for deletado
    // Isso dependerá de como você quer gerenciar os roles no User model

    res.json({ success: true, msg: "Cargo customizado deletado com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar cargo customizado:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Assign a custom role to a member
// @route   PUT /api/clans/:id/members/:userId/assign-role
// @access  Private (Clan Leader or ADM)
exports.assignMemberRole = async (req, res) => {
  const { userId } = req.params;
  const { roleName } = req.body;
  const clan = req.clan; // Obtained from middleware

  try {
    const userToAssign = await User.findById(userId);
    if (!userToAssign) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    if (!clan.members.includes(userId)) {
      return res.status(400).json({ msg: "Usuário não é membro deste clã." });
    }

    const customRole = clan.customRoles.find(role => role.name === roleName);
    if (!customRole) {
      return res.status(404).json({ msg: "Cargo customizado não encontrado." });
    }

    // Remover qualquer cargo customizado anterior do membro
    clan.memberRoles = clan.memberRoles.filter(mr => mr.user.toString() !== userId);

    // Atribuir o novo cargo
    clan.memberRoles.push({ user: userId, roleName });
    await clan.save();

    // Atualizar o clanRole do usuário no modelo User
    userToAssign.clanRole = roleName; // Ou um valor específico para cargos customizados
    await userToAssign.save();

    res.json({ success: true, msg: `Cargo '${roleName}' atribuído ao membro com sucesso!` });
  } catch (error) {
    console.error("Erro ao atribuir cargo customizado:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Remove a custom role from a member
// @route   PUT /api/clans/:id/members/:userId/remove-role
// @access  Private (Clan Leader or ADM)
exports.removeMemberRole = async (req, res) => {
  const { userId } = req.params;
  const clan = req.clan; // Obtained from middleware

  try {
    const userToRemoveRole = await User.findById(userId);
    if (!userToRemoveRole) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    const initialLength = clan.memberRoles.length;
    clan.memberRoles = clan.memberRoles.filter(mr => mr.user.toString() !== userId);

    if (clan.memberRoles.length === initialLength) {
      return res.status(400).json({ msg: "Membro não possui cargo customizado atribuído." });
    }

    await clan.save();

    // Reverter o clanRole do usuário para 

