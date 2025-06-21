const express = require("express");
const router = express.Router();
const qrrController = require("../controllers/qrrController");
const { protect } = require("../middleware/authMiddleware");
const { check, validationResult } = require("express-validator");

// Middleware para verificar se é ADM, líder do clã ou criador do QRR
const checkQRRPermission = async (req, res, next) => {
  const qrrId = req.params.id;
  if (!qrrId) {
    return res.status(400).json({ msg: "ID do QRR é obrigatório." });
  }

  try {
    const qrr = await QRR.findById(qrrId);
    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }

    const isCreator = qrr.createdBy.toString() === req.user.id;
    const clan = await Clan.findById(qrr.clan);
    const isLeader = clan && clan.leader.toString() === req.user.id;
    const isAdmin = req.user.role === "ADM";

    if (isCreator || isLeader || isAdmin) {
      req.qrr = qrr; // Anexa o QRR ao objeto de requisição
      next();
    } else {
      res.status(403).json({ msg: "Acesso negado. Permissão insuficiente." });
    }
  } catch (error) {
    console.error("Erro no middleware checkQRRPermission:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// @route   POST /api/qrrs
// @desc    Create a new QRR
// @access  Private (Clan Leader or ADM)
router.post(
  "/",
  protect,
  [
    check("title", "Título é obrigatório").not().isEmpty(),
    check("description", "Descrição é obrigatória").not().isEmpty(),
    check("clanId", "ID do clã é obrigatório").not().isEmpty(),
    check("startTime", "Hora de início é obrigatória").isISO8601(),
    check("endTime", "Hora de término é obrigatória").isISO8601(),
  ],
  qrrController.createQRR
);

// @route   GET /api/qrrs/clan/:clanId
// @desc    Get all QRRs for a specific clan
// @access  Private
router.get("/clan/:clanId", protect, qrrController.getQRRsByClan);

// @route   GET /api/qrrs/:id
// @desc    Get a single QRR by ID
// @access  Private
router.get("/:id", protect, qrrController.getQRRById);

// @route   PUT /api/qrrs/:id/status
// @desc    Update QRR status
// @access  Private (QRR Creator, Clan Leader or ADM)
router.put("/status/:id", protect, checkQRRPermission, qrrController.updateQRRStatus);

// @route   PUT /api/qrrs/:id/join
// @desc    Join a QRR
// @access  Private
router.put("/join/:id", protect, qrrController.joinQRR);

// @route   PUT /api/qrrs/:id/leave
// @desc    Leave a QRR
// @access  Private
router.put("/leave/:id", protect, qrrController.leaveQRR);

// @route   DELETE /api/qrrs/:id
// @desc    Delete a QRR
// @access  Private (QRR Creator, Clan Leader or ADM)
router.delete("/:id", protect, checkQRRPermission, qrrController.deleteQRR);

module.exports = router;


