// backend/controllers/voipController.js
const Call = require("../models/Call");
const User = require("../models/User");

// Helper opcional para erros
const serverError = (res, msg = "Erro interno do servidor") =>
  res.status(500).json({ error: msg });

// Iniciar chamada
exports.initiateCall = async (req, res) => {
  try {
    const { calleeId } = req.body;
    const callerId = req.user.id;

    const callee = await User.findById(calleeId);
    if (!callee) return res.status(404).json({ error: "Usuário não encontrado" });

    const channelId = `call_${Date.now()}`;
    const call = new Call({ caller: callerId, callee: calleeId, channelId });

    await call.save();

    req.io.to(calleeId).emit("incoming_call", {
      callId: call._id,
      callerId,
      channelId,
    });

    res.json({ success: true, callId: call._id, channelId });
  } catch (error) {
    serverError(res, "Erro ao iniciar chamada");
  }
};

// Aceitar chamada
exports.acceptCall = async (req, res) => {
  try {
    const { callId } = req.body;
    const call = await Call.findById(callId);

    if (!call || call.status !== "pending") {
      return res.status(400).json({ error: "Chamada inválida ou já aceita/rejeitada" });
    }

    call.status = "accepted";
    call.startTime = new Date();
    await call.save();

    req.io.to(call.caller).emit("call_accepted", { callId });
    req.io.to(call.callee).emit("call_accepted", { callId });

    res.json({ success: true });
  } catch (error) {
    serverError(res, "Erro ao aceitar chamada");
  }
};

// Rejeitar chamada
exports.rejectCall = async (req, res) => {
  try {
    const { callId } = req.body;
    const call = await Call.findById(callId);

    if (!call || call.status !== "pending") {
      return res.status(400).json({ error: "Chamada inválida ou já aceita/rejeitada" });
    }

    call.status = "rejected";
    await call.save();

    req.io.to(call.caller).emit("call_rejected", { callId });

    res.json({ success: true });
  } catch (error) {
    serverError(res, "Erro ao rejeitar chamada");
  }
};

// Encerrar chamada
exports.endCall = async (req, res) => {
  try {
    const { callId } = req.body;
    const call = await Call.findById(callId);

    if (!call || call.status !== "accepted") {
      return res.status(400).json({ error: "Chamada inválida ou já encerrada" });
    }

    call.status = "ended";
    call.endTime = new Date();
    call.duration = Math.floor((call.endTime - call.startTime) / 1000);
    await call.save();

    req.io.to(call.caller).emit("call_ended", { callId });
    req.io.to(call.callee).emit("call_ended", { callId });

    res.json({ success: true });
  } catch (error) {
    serverError(res, "Erro ao encerrar chamada");
  }
};

// Histórico de chamadas
exports.getCallHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const calls = await Call.find({
      $or: [{ caller: userId }, { callee: userId }],
    })
      .populate("caller", "username fotoPerfil")
      .populate("callee", "username fotoPerfil")
      .sort({ startTime: -1 })
      .limit(50);

    res.json({ success: true, calls });
  } catch (error) {
    serverError(res, "Erro ao buscar histórico");
  }
};
