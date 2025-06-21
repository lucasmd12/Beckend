const QRR = require("../models/QRR");
const User = require("../models/User");
const Clan = require("../models/Clan");

// @desc    Create a new QRR
// @route   POST /api/qrrs
// @access  Private (Clan Leader or ADM)
exports.createQRR = async (req, res) => {
  const { title, description, imageUrl, clanId, startTime, endTime } = req.body;

  try {
    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado." });
    }

    // Check if user is leader or ADM of the clan
    const isLeader = clan.leader && clan.leader.toString() === req.user.id;
    const isAdmin = req.user.role === "ADM";

    if (!isLeader && !isAdmin) {
      return res.status(403).json({ msg: "Acesso negado. Apenas o líder do clã ou ADM pode criar QRR." });
    }

    const newQRR = new QRR({
      title,
      description,
      imageUrl,
      createdBy: req.user.id,
      clan: clanId,
      startTime,
      endTime,
    });

    const qrr = await newQRR.save();
    res.status(201).json({ success: true, data: qrr });
  } catch (error) {
    console.error("Erro ao criar QRR:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Get all QRRs for a specific clan
// @route   GET /api/qrrs/clan/:clanId
// @access  Private
exports.getQRRsByClan = async (req, res) => {
  try {
    const qrrs = await QRR.find({ clan: req.params.clanId })
      .populate("createdBy", "username avatar")
      .populate("participants.user", "username avatar");
    res.json({ success: true, data: qrrs });
  } catch (error) {
    console.error("Erro ao obter QRRs por clã:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Get a single QRR by ID
// @route   GET /api/qrrs/:id
// @access  Private
exports.getQRRById = async (req, res) => {
  try {
    const qrr = await QRR.findById(req.params.id)
      .populate("createdBy", "username avatar")
      .populate("participants.user", "username avatar");

    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }
    res.json({ success: true, data: qrr });
  } catch (error) {
    console.error("Erro ao obter QRR:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Update QRR status (e.g., active, completed, cancelled)
// @route   PUT /api/qrrs/:id/status
// @access  Private (QRR Creator, Clan Leader or ADM)
exports.updateQRRStatus = async (req, res) => {
  const { status } = req.body;

  try {
    const qrr = await QRR.findById(req.params.id);
    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }

    // Check if user is creator, clan leader or ADM
    const isCreator = qrr.createdBy.toString() === req.user.id;
    const clan = await Clan.findById(qrr.clan);
    const isLeader = clan && clan.leader.toString() === req.user.id;
    const isAdmin = req.user.role === "ADM";

    if (!isCreator && !isLeader && !isAdmin) {
      return res.status(403).json({ msg: "Acesso negado. Permissão insuficiente para atualizar o status do QRR." });
    }

    qrr.status = status;
    await qrr.save();
    res.json({ success: true, data: qrr });
  } catch (error) {
    console.error("Erro ao atualizar status do QRR:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Join a QRR
// @route   PUT /api/qrrs/:id/join
// @access  Private
exports.joinQRR = async (req, res) => {
  try {
    const qrr = await QRR.findById(req.params.id);
    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }

    if (qrr.participants.some(p => p.user.toString() === req.user.id)) {
      return res.status(400).json({ msg: "Você já está participando deste QRR." });
    }

    qrr.participants.push({ user: req.user.id });
    await qrr.save();
    res.json({ success: true, msg: "Você entrou no QRR com sucesso!", data: qrr });
  } catch (error) {
    console.error("Erro ao entrar no QRR:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Leave a QRR
// @route   PUT /api/qrrs/:id/leave
// @access  Private
exports.leaveQRR = async (req, res) => {
  try {
    const qrr = await QRR.findById(req.params.id);
    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }

    const initialLength = qrr.participants.length;
    qrr.participants = qrr.participants.filter(p => p.user.toString() !== req.user.id);

    if (qrr.participants.length === initialLength) {
      return res.status(400).json({ msg: "Você não está participando deste QRR." });
    }

    await qrr.save();
    res.json({ success: true, msg: "Você saiu do QRR com sucesso!", data: qrr });
  } catch (error) {
    console.error("Erro ao sair do QRR:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @desc    Delete a QRR
// @route   DELETE /api/qrrs/:id
// @access  Private (QRR Creator, Clan Leader or ADM)
exports.deleteQRR = async (req, res) => {
  try {
    const qrr = await QRR.findById(req.params.id);
    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }

    // Check if user is creator, clan leader or ADM
    const isCreator = qrr.createdBy.toString() === req.user.id;
    const clan = await Clan.findById(qrr.clan);
    const isLeader = clan && clan.leader.toString() === req.user.id;
    const isAdmin = req.user.role === "ADM";

    if (!isCreator && !isLeader && !isAdmin) {
      return res.status(403).json({ msg: "Acesso negado. Permissão insuficiente para deletar o QRR." });
    }

    await qrr.deleteOne();
    res.json({ success: true, msg: "QRR deletado com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar QRR:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};


