
const ClanWar = require("../models/ClanWar");
const Clan = require("../models/Clan");
const User = require("../models/User");
const mongoose = require("mongoose");

// Função auxiliar para verificar se o usuário é líder ou sublíder de um clã
const isClanLeaderOrSubLeader = (clan, userId) => {
  return clan.leader.toString() === userId.toString() || clan.subLeaders.includes(userId);
};

// Declarar guerra a outro clã
exports.declareWar = async (req, res) => {
  const { challengedClanId, rules } = req.body;
  const challengerClanId = req.user.clan;
  const declaredById = req.user._id;

  if (!challengerClanId) {
    return res.status(400).json({ msg: "Você precisa pertencer a um clã para declarar guerra." });
  }

  if (challengerClanId.toString() === challengedClanId) {
    return res.status(400).json({ msg: "Um clã não pode declarar guerra a si mesmo." });
  }

  try {
    const challengerClan = await Clan.findById(challengerClanId);
    const challengedClan = await Clan.findById(challengedClanId);

    if (!challengerClan || !challengedClan) {
      return res.status(404).json({ msg: "Um dos clãs não foi encontrado." });
    }

    if (!isClanLeaderOrSubLeader(challengerClan, declaredById)) {
      return res.status(403).json({ msg: "Apenas líderes ou sublíderes podem declarar guerra." });
    }

    const existingWar = await ClanWar.findOne({
      $or: [
        { challengerClan: challengerClanId, challengedClan: challengedClanId, status: { $in: ["pending", "active"] } },
        { challengerClan: challengedClanId, challengedClan: challengerClanId, status: { $in: ["pending", "active"] } },
      ],
    });

    if (existingWar) {
      return res.status(400).json({ msg: "Já existe uma guerra pendente ou ativa entre esses clãs." });
    }

    const newWar = new ClanWar({
      challengerClan: challengerClanId,
      challengedClan: challengedClanId,
      rules,
      declaredBy: declaredById,
    });

    await newWar.save();

    res.status(201).json({ msg: "Guerra declarada com sucesso! Aguardando resposta do clã desafiado.", war: newWar });
  } catch (error) {
    console.error("Erro ao declarar guerra:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};




// Aceitar uma guerra de clãs
exports.acceptWar = async (req, res) => {
  const { warId } = req.params;
  const userId = req.user._id;

  try {
    const war = await ClanWar.findById(warId);

    if (!war) {
      return res.status(404).json({ msg: "Guerra não encontrada." });
    }

    if (war.status !== "pending") {
      return res.status(400).json({ msg: "Esta guerra não está pendente." });
    }

    if (war.challengedClan.toString() !== req.user.clan.toString()) {
      return res.status(403).json({ msg: "Você não é o clã desafiado nesta guerra." });
    }

    const challengedClan = await Clan.findById(war.challengedClan);
    if (!isClanLeaderOrSubLeader(challengedClan, userId)) {
      return res.status(403).json({ msg: "Apenas líderes ou sublíderes do clã desafiado podem aceitar a guerra." });
    }

    war.status = "accepted";
    war.startedAt = new Date();
    war.respondedBy = userId;
    await war.save();

    res.status(200).json({ msg: "Guerra aceita! A batalha começou.", war });
  } catch (error) {
    console.error("Erro ao aceitar guerra:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};




// Rejeitar uma guerra de clãs
exports.rejectWar = async (req, res) => {
  const { warId } = req.params;
  const userId = req.user._id;

  try {
    const war = await ClanWar.findById(warId);

    if (!war) {
      return res.status(404).json({ msg: "Guerra não encontrada." });
    }

    if (war.status !== "pending") {
      return res.status(400).json({ msg: "Esta guerra não está pendente." });
    }

    if (war.challengedClan.toString() !== req.user.clan.toString()) {
      return res.status(403).json({ msg: "Você não é o clã desafiado nesta guerra." });
    }

    const challengedClan = await Clan.findById(war.challengedClan);
    if (!isClanLeaderOrSubLeader(challengedClan, userId)) {
      return res.status(403).json({ msg: "Apenas líderes ou sublíderes do clã desafiado podem rejeitar a guerra." });
    }

    war.status = "rejected";
    war.endedAt = new Date();
    war.respondedBy = userId;
    await war.save();

    res.status(200).json({ msg: "Guerra rejeitada com sucesso.", war });
  } catch (error) {
    console.error("Erro ao rejeitar guerra:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};




// Reportar o resultado de uma guerra de clãs
exports.reportWarResult = async (req, res) => {
  const { warId } = req.params;
  const { winnerClanId, challengerScore, challengedScore, evidence } = req.body;
  const userId = req.user._id;

  try {
    const war = await ClanWar.findById(warId);

    if (!war) {
      return res.status(404).json({ msg: "Guerra não encontrada." });
    }

    if (war.status !== "active") {
      return res.status(400).json({ msg: "Esta guerra não está ativa." });
    }

    // Verificar se o usuário que está reportando pertence a um dos clãs da guerra e é líder/sublíder
    const isChallengerLeader = war.challengerClan.toString() === req.user.clan.toString() && isClanLeaderOrSubLeader(await Clan.findById(war.challengerClan), userId);
    const isChallengedLeader = war.challengedClan.toString() === req.user.clan.toString() && isClanLeaderOrSubLeader(await Clan.findById(war.challengedClan), userId);

    if (!isChallengerLeader && !isChallengedLeader) {
      return res.status(403).json({ msg: "Apenas líderes ou sublíderes dos clãs participantes podem reportar o resultado." });
    }

    // Determinar o clã vencedor e perdedor
    let winnerClan, loserClan;
    if (winnerClanId.toString() === war.challengerClan.toString()) {
      winnerClan = war.challengerClan;
      loserClan = war.challengedClan;
    } else if (winnerClanId.toString() === war.challengedClan.toString()) {
      winnerClan = war.challengedClan;
      loserClan = war.challengerClan;
    } else {
      return res.status(400).json({ msg: "O clã vencedor deve ser um dos clãs participantes da guerra." });
    }

    war.winnerClan = winnerClan;
    war.loserClan = loserClan;
    war.score = { challenger: challengerScore, challenged: challengedScore };
    war.evidence = evidence || [];
    war.status = "completed";
    war.endedAt = new Date();
    war.reportedBy = userId;

    await war.save();

    res.status(200).json({ msg: "Resultado da guerra reportado com sucesso!", war });
  } catch (error) {
    console.error("Erro ao reportar resultado da guerra:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};




// Cancelar uma guerra de clãs
exports.cancelWar = async (req, res) => {
  const { warId } = req.params;
  const { reason } = req.body;
  const userId = req.user._id;

  try {
    const war = await ClanWar.findById(warId);

    if (!war) {
      return res.status(404).json({ msg: "Guerra não encontrada." });
    }

    if (war.status !== "pending" && war.status !== "active") {
      return res.status(400).json({ msg: "A guerra não pode ser cancelada neste status." });
    }

    // Verificar se o usuário que está cancelando pertence a um dos clãs da guerra e é líder/sublíder
    const isChallengerLeader = war.challengerClan.toString() === req.user.clan.toString() && isClanLeaderOrSubLeader(await Clan.findById(war.challengerClan), userId);
    const isChallengedLeader = war.challengedClan.toString() === req.user.clan.toString() && isClanLeaderOrSubLeader(await Clan.findById(war.challengedClan), userId);
    const isAdmin = req.user.role === "ADM";

    if (!isChallengerLeader && !isChallengedLeader && !isAdmin) {
      return res.status(403).json({ msg: "Apenas líderes, sublíderes dos clãs participantes ou ADM podem cancelar a guerra." });
    }

    war.status = "cancelled";
    war.endedAt = new Date();
    war.cancellationReason = reason || "Cancelada pelos participantes.";
    war.reportedBy = userId; // Quem cancelou

    await war.save();

    res.status(200).json({ msg: "Guerra cancelada com sucesso.", war });
  } catch (error) {
    console.error("Erro ao cancelar guerra:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};




// Obter todas as guerras ativas
exports.getActiveWars = async (req, res) => {
  try {
    const activeWars = await ClanWar.find({ status: "active" })
      .populate("challengerClan", "name tag banner")
      .populate("challengedClan", "name tag banner")
      .select("-evidence"); // Não retornar evidências em listagens públicas

    res.status(200).json({ success: true, wars: activeWars });
  } catch (error) {
    console.error("Erro ao obter guerras ativas:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};




const ClanWar = require("../models/ClanWar");

exports.getAllClanWars = async (req, res) => {
  try {
    const wars = await ClanWar.find().sort({ declaredAt: -1 });
    res.json({ success: true, wars });
  } catch (error) {
    console.error("Erro ao obter todas as guerras de clãs:", error);
    res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }
};

