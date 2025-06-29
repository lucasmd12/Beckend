const QRR = require("../models/QRR");
const User = require("../models/User");
const Clan = require("../models/Clan");
const Federation = require("../models/Federation");
const AutoNotificationService = require("../services/autoNotificationService");

// @desc    Accept a federation QRR for a clan
// @route   PUT /api/qrrs/:id/accept-for-clan/:clanId
// @access  Private (Clan Leader or ADM)
exports.acceptQRRForClan = async (req, res) => {
  try {
    const { id: qrrId, clanId } = req.params;

    const qrr = await QRR.findById(qrrId);
    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }

    // Verificar se é uma QRR de federação
    if (!qrr.federation) {
      return res.status(400).json({ msg: "Esta QRR não é de federação." });
    }

    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado." });
    }

    // Verificar se o usuário é líder do clã ou ADM
    const isLeader = clan.leader && clan.leader.toString() === req.user.id;
    const isAdmin = req.user.role === "ADM";

    if (!isLeader && !isAdmin) {
      return res.status(403).json({ msg: "Acesso negado. Apenas o líder do clã ou ADM pode aceitar QRR para o clã." });
    }

    // Verificar se o clã já aceitou esta QRR
    if (qrr.acceptedByClans && qrr.acceptedByClans.includes(clanId)) {
      return res.status(400).json({ msg: "Este clã já aceitou esta QRR." });
    }

    // Adicionar o clã à lista de clãs que aceitaram
    if (!qrr.acceptedByClans) {
      qrr.acceptedByClans = [];
    }
    qrr.acceptedByClans.push(clanId);
    await qrr.save();

    // 🚀 NOVA FUNCIONALIDADE: Notificar membros do clã sobre QRR aceita
    try {
      const acceptedByUser = await User.findById(req.user.id).select('username avatar');
      await AutoNotificationService.notifyQRRAcceptedByClanLeader(qrr, clanId, acceptedByUser);
    } catch (notificationError) {
      console.error("Erro ao enviar notificação de QRR aceita:", notificationError);
      // Não falhar a aceitação por causa da notificação
    }

    res.json({ 
      success: true, 
      msg: "QRR aceita para o clã com sucesso!",
      data: qrr 
    });
  } catch (error) {
    console.error("Erro ao aceitar QRR para clã:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Reject a federation QRR for a clan
// @route   PUT /api/qrrs/:id/reject-for-clan/:clanId
// @access  Private (Clan Leader or ADM)
exports.rejectQRRForClan = async (req, res) => {
  try {
    const { id: qrrId, clanId } = req.params;

    const qrr = await QRR.findById(qrrId);
    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }

    // Verificar se é uma QRR de federação
    if (!qrr.federation) {
      return res.status(400).json({ msg: "Esta QRR não é de federação." });
    }

    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado." });
    }

    // Verificar se o usuário é líder do clã ou ADM
    const isLeader = clan.leader && clan.leader.toString() === req.user.id;
    const isAdmin = req.user.role === "ADM";

    if (!isLeader && !isAdmin) {
      return res.status(403).json({ msg: "Acesso negado. Apenas o líder do clã ou ADM pode rejeitar QRR para o clã." });
    }

    // Remover o clã da lista de clãs que aceitaram (se estiver lá)
    if (qrr.acceptedByClans) {
      qrr.acceptedByClans = qrr.acceptedByClans.filter(id => id.toString() !== clanId);
    }

    // Adicionar à lista de clãs que rejeitaram
    if (!qrr.rejectedByClans) {
      qrr.rejectedByClans = [];
    }
    if (!qrr.rejectedByClans.includes(clanId)) {
      qrr.rejectedByClans.push(clanId);
    }

    await qrr.save();

    res.json({ 
      success: true, 
      msg: "QRR rejeitada para o clã.",
      data: qrr 
    });
  } catch (error) {
    console.error("Erro ao rejeitar QRR para clã:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Get QRRs available for a clan (including federation QRRs)
// @route   GET /api/qrrs/available/:clanId
// @access  Private
exports.getAvailableQRRsForClan = async (req, res) => {
  try {
    const { clanId } = req.params;

    const clan = await Clan.findById(clanId).populate('federation');
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado." });
    }

    // QRRs do próprio clã
    const clanQRRs = await QRR.find({ clan: clanId })
      .populate("createdBy", "username avatar")
      .populate("participants.user", "username avatar");

    // QRRs de federação (se o clã pertencer a uma federação)
    let federationQRRs = [];
    if (clan.federation) {
      federationQRRs = await QRR.find({ 
        federation: clan.federation._id,
        // Incluir QRRs que ainda não foram aceitas ou rejeitadas por este clã
        $and: [
          { $or: [
            { acceptedByClans: { $ne: clanId } },
            { acceptedByClans: { $exists: false } }
          ]},
          { $or: [
            { rejectedByClans: { $ne: clanId } },
            { rejectedByClans: { $exists: false } }
          ]}
        ]
      })
      .populate("createdBy", "username avatar")
      .populate("participants.user", "username avatar");
    }

    res.json({ 
      success: true, 
      data: {
        clanQRRs,
        federationQRRs,
        total: clanQRRs.length + federationQRRs.length
      }
    });
  } catch (error) {
    console.error("Erro ao obter QRRs disponíveis para clã:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

module.exports = {
  acceptQRRForClan: exports.acceptQRRForClan,
  rejectQRRForClan: exports.rejectQRRForClan,
  getAvailableQRRsForClan: exports.getAvailableQRRsForClan
};

