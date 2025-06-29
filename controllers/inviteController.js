const Invite = require("../models/Invite");
const User = require("../models/User");
const Clan = require("../models/Clan");
const Federation = require("../models/Federation");
const Notification = require("../models/Notification");
const cacheService = require("../services/cacheService");
const CacheKeys = require("../utils/cacheKeys");

// @desc    Create a new invite
// @route   POST /api/invites
// @access  Private (Leader, Sub-leader, or ADM)
exports.createInvite = async (req, res) => {
  const { recipientId, type, targetId } = req.body;
  const senderId = req.user.id;

  try {
    // 1. Validar se o remetente tem permissão para enviar o convite
    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ msg: "Remetente não encontrado." });
    }

    // 2. Validar o destinatário
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ msg: "Destinatário não encontrado." });
    }

    // 3. Validar o tipo e o alvo do convite
    let targetEntity;
    switch (type) {
      case "clan":
        targetEntity = await Clan.findById(targetId);
        if (!targetEntity) return res.status(404).json({ msg: "Clã não encontrado." });
        // Lógica de permissão para convidar para clã
        if (sender.clan.toString() !== targetId || (sender.clanRole !== "Leader" && sender.clanRole !== "SubLeader" && sender.role !== "ADM")) {
          return res.status(403).json({ msg: "Você não tem permissão para convidar para este clã." });
        }
        if (recipient.clan) {
          return res.status(400).json({ msg: "O destinatário já pertence a um clã." });
        }
        break;
      case "federation":
        targetEntity = await Federation.findById(targetId);
        if (!targetEntity) return res.status(404).json({ msg: "Federação não encontrada." });
        // Lógica de permissão para convidar para federação
        if (sender.federation.toString() !== targetId || (sender.federationRole !== "Leader" && sender.role !== "ADM")) {
          return res.status(403).json({ msg: "Você não tem permissão para convidar para esta federação." });
        }
        if (recipient.federation) {
          return res.status(400).json({ msg: "O destinatário já pertence a uma federação." });
        }
        break;
      // case 


      case "channel":
        // Lógica para convite de canal (se aplicável)
        return res.status(400).json({ msg: "Convites para canais não implementados." });
      default:
        return res.status(400).json({ msg: "Tipo de convite inválido." });
    }

    // 4. Verificar se já existe um convite pendente
    const existingInvite = await Invite.findOne({
      recipient: recipientId,
      type,
      target: targetId,
      status: "pending",
    });

    if (existingInvite) {
      return res.status(400).json({ msg: "Já existe um convite pendente para este usuário." });
    }

    // 5. Criar o convite
    const invite = new Invite({
      type,
      target: targetId,
      sender: senderId,
      recipient: recipientId,
    });

    await invite.save();

    // 6. Enviar notificação ao destinatário (TODO: Integrar com o sistema de notificações)
    // await Notification.create({
    //   recipient: recipientId,
    //   type: "invite",
    //   message: `Você recebeu um convite para ${type === 'clan' ? 'o clã' : 'a federação'} ${targetEntity.name}!`, 
    //   payload: { inviteId: invite._id, type, targetId, senderId }
    // });

    res.status(201).json({ success: true, msg: "Convite enviado com sucesso!", data: invite });
  } catch (error) {
    console.error("Erro ao criar convite:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Get invites for the current user
// @route   GET /api/invites/me
// @access  Private
exports.getMyInvites = async (req, res) => {
  try {
    const invites = await Invite.find({ recipient: req.user.id, status: "pending" })
      .populate("sender", "username avatar")
      .populate("target", "name tag") // Popula nome e tag do clã/federação
      .lean();

    res.json({ success: true, count: invites.length, data: invites });
  } catch (error) {
    console.error("Erro ao obter convites:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Accept an invite
// @route   PUT /api/invites/:id/accept
// @access  Private
exports.acceptInvite = async (req, res) => {
  const { id } = req.params;

  try {
    const invite = await Invite.findOne({ _id: id, recipient: req.user.id, status: "pending" });
    if (!invite) {
      return res.status(404).json({ msg: "Convite não encontrado ou já respondido." });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    let targetEntity;
    if (invite.type === "clan") {
      targetEntity = await Clan.findById(invite.target);
      if (!targetEntity) return res.status(404).json({ msg: "Clã não encontrado." });
      if (user.clan) return res.status(400).json({ msg: "Você já pertence a um clã." });

      targetEntity.members.push(user._id);
      await targetEntity.save();

      user.clan = targetEntity._id;
      user.clanRole = "member";
      await user.save();

    } else if (invite.type === "federation") {
      targetEntity = await Federation.findById(invite.target);
      if (!targetEntity) return res.status(404).json({ msg: "Federação não encontrada." });
      if (user.federation) return res.status(400).json({ msg: "Você já pertence a uma federação." });

      targetEntity.members.push(user._id);
      await targetEntity.save();

      user.federation = targetEntity._id;
      user.federationRole = "member";
      await user.save();
    }

    invite.status = "accepted";
    invite.respondedAt = Date.now();
    await invite.save();

    res.json({ success: true, msg: `Convite para ${invite.type} aceito com sucesso!` });
  } catch (error) {
    console.error("Erro ao aceitar convite:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Reject an invite
// @route   PUT /api/invites/:id/reject
// @access  Private
exports.rejectInvite = async (req, res) => {
  const { id } = req.params;

  try {
    const invite = await Invite.findOne({ _id: id, recipient: req.user.id, status: "pending" });
    if (!invite) {
      return res.status(404).json({ msg: "Convite não encontrado ou já respondido." });
    }

    invite.status = "rejected";
    invite.respondedAt = Date.now();
    await invite.save();

    res.json({ success: true, msg: "Convite rejeitado com sucesso!" });
  } catch (error) {
    console.error("Erro ao rejeitar convite:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};


