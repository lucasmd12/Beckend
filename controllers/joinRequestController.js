const JoinRequest = require("../models/JoinRequest");
const User = require("../models/User");
const Clan = require("../models/Clan");
const Federation = require("../models/Federation");
const Notification = require("../models/Notification");

// @desc    Create a new join request
// @route   POST /api/join-requests
// @access  Private (User)
exports.createJoinRequest = async (req, res) => {
  const { type, targetId } = req.body;
  const requesterId = req.user.id;

  try {
    // 1. Validar se o solicitante já está no clã/federação
    const requester = await User.findById(requesterId);
    if (!requester) {
      return res.status(404).json({ msg: "Solicitante não encontrado." });
    }

    let targetEntity;
    if (type === "clan") {
      targetEntity = await Clan.findById(targetId);
      if (!targetEntity) return res.status(404).json({ msg: "Clã não encontrado." });
      if (requester.clan && requester.clan.toString() === targetId) {
        return res.status(400).json({ msg: "Você já pertence a este clã." });
      }
      if (requester.clan) {
        return res.status(400).json({ msg: "Você já pertence a outro clã. Saia do clã atual para enviar uma nova solicitação." });
      }
    } else if (type === "federation") {
      targetEntity = await Federation.findById(targetId);
      if (!targetEntity) return res.status(404).json({ msg: "Federação não encontrada." });
      if (requester.federation && requester.federation.toString() === targetId) {
        return res.status(400).json({ msg: "Você já pertence a esta federação." });
      }
      if (requester.federation) {
        return res.status(400).json({ msg: "Você já pertence a outra federação. Saia da federação atual para enviar uma nova solicitação." });
      }
    } else {
      return res.status(400).json({ msg: "Tipo de solicitação inválido." });
    }

    // 2. Verificar se já existe uma solicitação pendente
    const existingRequest = await JoinRequest.findOne({
      requester: requesterId,
      type,
      target: targetId,
      status: "pending",
    });

    if (existingRequest) {
      return res.status(400).json({ msg: "Você já tem uma solicitação pendente para este clã/federação." });
    }

    // 3. Criar a solicitação
    const joinRequest = new JoinRequest({
      type,
      target: targetId,
      requester: requesterId,
    });

    await joinRequest.save();

    // 4. Notificar o líder/administrador (TODO: Integrar com o sistema de notificações)
    // if (type === "clan") {
    //   const leader = await User.findById(targetEntity.leader);
    //   if (leader) {
    //     await Notification.create({
    //       recipient: leader._id,
    //       type: "join_request",
    //       message: `${requester.username} solicitou entrada no seu clã ${targetEntity.name}!`, 
    //       payload: { requestId: joinRequest._id, type, targetId, requesterId }
    //     });
    //   }
    // } else if (type === "federation") {
    //   // Notificar administradores da federação
    // }

    res.status(201).json({ success: true, msg: "Solicitação de entrada enviada com sucesso!", data: joinRequest });
  } catch (error) {
    console.error("Erro ao criar solicitação de entrada:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Get join requests for the current user (as requester)
// @route   GET /api/join-requests/me
// @access  Private
exports.getMyJoinRequests = async (req, res) => {
  try {
    const requests = await JoinRequest.find({ requester: req.user.id })
      .populate("target", "name tag")
      .lean();

    res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    console.error("Erro ao obter minhas solicitações de entrada:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Get join requests for a specific clan/federation (for leaders/admins)
// @route   GET /api/join-requests/target/:targetId
// @access  Private (Leader, Sub-leader, or ADM)
exports.getJoinRequestsForTarget = async (req, res) => {
  const { targetId } = req.params;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "Usuário não encontrado." });

    let targetEntity;
    let query = { target: targetId, status: "pending" };

    // Verificar permissões
    if (user.clan && user.clan.toString() === targetId) {
      targetEntity = await Clan.findById(targetId);
      if (!targetEntity) return res.status(404).json({ msg: "Clã não encontrado." });
      if (user.clanRole !== "Leader" && user.clanRole !== "SubLeader" && user.role !== "ADM") {
        return res.status(403).json({ msg: "Você não tem permissão para ver as solicitações deste clã." });
      }
      query.type = "clan";
    } else if (user.federation && user.federation.toString() === targetId) {
      targetEntity = await Federation.findById(targetId);
      if (!targetEntity) return res.status(404).json({ msg: "Federação não encontrada." });
      if (user.federationRole !== "leader" && user.role !== "ADM") {
        return res.status(403).json({ msg: "Você não tem permissão para ver as solicitações desta federação." });
      }
      query.type = "federation";
    } else if (user.role === "ADM") {
      // ADM pode ver qualquer solicitação
      // Não precisamos restringir por tipo ou targetId aqui, a menos que o ADM especifique
    } else {
      return res.status(403).json({ msg: "Você não tem permissão para ver solicitações para este alvo." });
    }

    const requests = await JoinRequest.find(query)
      .populate("requester", "username avatar")
      .lean();

    res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    console.error("Erro ao obter solicitações de entrada para o alvo:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Accept a join request
// @route   PUT /api/join-requests/:id/accept
// @access  Private (Leader, Sub-leader, or ADM)
exports.acceptJoinRequest = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const joinRequest = await JoinRequest.findOne({ _id: id, status: "pending" });
    if (!joinRequest) {
      return res.status(404).json({ msg: "Solicitação não encontrada ou já respondida." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "Usuário não encontrado." });

    // Verificar permissões para aceitar
    if (joinRequest.type === "clan") {
      if (user.clan.toString() !== joinRequest.target.toString() || (user.clanRole !== "Leader" && user.clanRole !== "SubLeader" && user.role !== "ADM")) {
        return res.status(403).json({ msg: "Você não tem permissão para aceitar esta solicitação de clã." });
      }
    } else if (joinRequest.type === "federation") {
      if (user.federation.toString() !== joinRequest.target.toString() || (user.federationRole !== "leader" && user.role !== "ADM")) {
        return res.status(403).json({ msg: "Você não tem permissão para aceitar esta solicitação de federação." });
      }
    } else {
      return res.status(400).json({ msg: "Tipo de solicitação inválido." });
    }

    const requester = await User.findById(joinRequest.requester);
    if (!requester) {
      return res.status(404).json({ msg: "Solicitante não encontrado." });
    }

    if (joinRequest.type === "clan") {
      if (requester.clan) {
        return res.status(400).json({ msg: "O solicitante já pertence a um clã." });
      }
      const clan = await Clan.findById(joinRequest.target);
      if (!clan) return res.status(404).json({ msg: "Clã não encontrado." });

      clan.members.push(requester._id);
      await clan.save();

      requester.clan = clan._id;
      requester.clanRole = "member";
      await requester.save();

    } else if (joinRequest.type === "federation") {
      if (requester.federation) {
        return res.status(400).json({ msg: "O solicitante já pertence a uma federação." });
      }
      const federation = await Federation.findById(joinRequest.target);
      if (!federation) return res.status(404).json({ msg: "Federação não encontrada." });

      federation.members.push(requester._id);
      await federation.save();

      requester.federation = federation._id;
      requester.federationRole = "member";
      await requester.save();
    }

    joinRequest.status = "accepted";
    joinRequest.respondedAt = Date.now();
    await joinRequest.save();

    // Notificar o solicitante (TODO: Integrar com o sistema de notificações)
    // await Notification.create({
    //   recipient: requester._id,
    //   type: "join_request_accepted",
    //   message: `Sua solicitação para ${joinRequest.type} foi aceita!`, 
    //   payload: { requestId: joinRequest._id }
    // });

    res.json({ success: true, msg: `Solicitação para ${joinRequest.type} aceita com sucesso!` });
  } catch (error) {
    console.error("Erro ao aceitar solicitação de entrada:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Reject a join request
// @route   PUT /api/join-requests/:id/reject
// @access  Private (Leader, Sub-leader, or ADM)
exports.rejectJoinRequest = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const joinRequest = await JoinRequest.findOne({ _id: id, status: "pending" });
    if (!joinRequest) {
      return res.status(404).json({ msg: "Solicitação não encontrada ou já respondida." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "Usuário não encontrado." });

    // Verificar permissões para rejeitar
    if (joinRequest.type === "clan") {
      if (user.clan.toString() !== joinRequest.target.toString() || (user.clanRole !== "Leader" && user.clanRole !== "SubLeader" && user.role !== "ADM")) {
        return res.status(403).json({ msg: "Você não tem permissão para rejeitar esta solicitação de clã." });
      }
    } else if (joinRequest.type === "federation") {
      if (user.federation.toString() !== joinRequest.target.toString() || (user.federationRole !== "leader" && user.role !== "ADM")) {
        return res.status(403).json({ msg: "Você não tem permissão para rejeitar esta solicitação de federação." });
      }
    } else {
      return res.status(400).json({ msg: "Tipo de solicitação inválido." });
    }

    joinRequest.status = "rejected";
    joinRequest.respondedAt = Date.now();
    await joinRequest.save();

    // Notificar o solicitante (TODO: Integrar com o sistema de notificações)
    // await Notification.create({
    //   recipient: joinRequest.requester._id,
    //   type: "join_request_rejected",
    //   message: `Sua solicitação para ${joinRequest.type} foi rejeitada.`, 
    //   payload: { requestId: joinRequest._id }
    // });

    res.json({ success: true, msg: "Solicitação rejeitada com sucesso!" });
  } catch (error) {
    console.error("Erro ao rejeitar solicitação de entrada:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};


