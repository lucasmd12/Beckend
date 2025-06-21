const Call = require("../models/Call");
const User = require("../models/User");
const logger = require("../utils/logger");
const generateJitsiToken = require("../utils/jitsiToken"); // Importar o gerador de token Jitsi

// Função para iniciar uma chamada 1x1
exports.initiateCall = async (req, res) => {
  const { receiverId } = req.body;
  const callerId = req.user.id; // ID do usuário autenticado (caller)

  try {
    const caller = await User.findById(callerId);
    const receiver = await User.findById(receiverId);

    if (!caller || !receiver) {
      return res.status(404).json({ msg: "Chamador ou receptor não encontrado." });
    }

    // Criar um registro de chamada no DB
    const newCall = new Call({
      caller: callerId,
      receiver: receiverId,
      status: "pending",
      startTime: new Date(),
    });

    await newCall.save();

    // Gerar token Jitsi para o chamador
    const callerJitsiToken = generateJitsiToken(caller, newCall._id.toString());

    // Emitir um evento via Socket.IO para o receptor com o token Jitsi
    req.io.to(req.io.connectedUsers.get(receiverId)).emit("incoming_call", {
      callId: newCall._id,
      callerId: caller._id,
      callerUsername: caller.username,
      roomName: newCall._id.toString(), // Enviar o nome da sala para o receptor
      jitsiToken: generateJitsiToken(receiver, newCall._id.toString()), // Token para o receptor
    });

    logger.info(`Chamada iniciada por ${caller.username} para ${receiver.username}. Call ID: ${newCall._id}`);
    res.status(200).json({ msg: "Chamada iniciada com sucesso.", callId: newCall._id, roomName: newCall._id.toString(), jitsiToken: callerJitsiToken });
  } catch (err) {
    logger.error(`Erro ao iniciar chamada: ${err.message}`);
    res.status(500).send("Erro no servidor ao iniciar chamada.");
  }
};

// Função para aceitar uma chamada
exports.acceptCall = async (req, res) => {
  const { callId } = req.body;
  const userId = req.user.id; // ID do usuário autenticado (receptor)

  try {
    const call = await Call.findById(callId);
    const accepter = await User.findById(userId);

    if (!call) {
      return res.status(404).json({ msg: "Chamada não encontrada." });
    }

    if (call.receiver.toString() !== userId) {
      return res.status(403).json({ msg: "Você não tem permissão para aceitar esta chamada." });
    }

    call.status = "active";
    call.acceptedTime = new Date();
    await call.save();

    // Gerar token Jitsi para o aceitador
    const accepterJitsiToken = generateJitsiToken(accepter, call._id.toString());

    // Notificar o chamador via Socket.IO que a chamada foi aceita e enviar o token Jitsi
    req.io.to(req.io.connectedUsers.get(call.caller.toString())).emit("call_accepted", {
      callId: call._id,
      accepterId: userId,
      roomName: call._id.toString(),
      jitsiToken: generateJitsiToken(await User.findById(call.caller), call._id.toString()), // Token para o chamador
    });

    logger.info(`Chamada ${callId} aceita por ${userId}.`);
    res.status(200).json({ msg: "Chamada aceita com sucesso.", call, roomName: call._id.toString(), jitsiToken: accepterJitsiToken });
  } catch (err) {
    logger.error(`Erro ao aceitar chamada: ${err.message}`);
    res.status(500).send("Erro no servidor ao aceitar chamada.");
  }
};

// Função para rejeitar uma chamada
exports.rejectCall = async (req, res) => {
  const { callId } = req.body;
  const userId = req.user.id;

  try {
    const call = await Call.findById(callId);

    if (!call) {
      return res.status(404).json({ msg: "Chamada não encontrada." });
    }

    if (call.receiver.toString() !== userId) {
      return res.status(403).json({ msg: "Você não tem permissão para rejeitar esta chamada." });
    }

    call.status = "rejected";
    call.endTime = new Date();
    await call.save();

    // Notificar o chamador via Socket.IO que a chamada foi rejeitada
    req.io.to(req.io.connectedUsers.get(call.caller.toString())).emit("call_rejected", {
      callId: call._id,
      rejecterId: userId,
    });

    logger.info(`Chamada ${callId} rejeitada por ${userId}.`);
    res.status(200).json({ msg: "Chamada rejeitada com sucesso.", call });
  } catch (err) {
    logger.error(`Erro ao rejeitar chamada: ${err.message}`);
    res.status(500).send("Erro no servidor ao rejeitar chamada.");
  }
};

// Função para encerrar uma chamada
exports.endCall = async (req, res) => {
  const { callId } = req.body;
  const userId = req.user.id;

  try {
    const call = await Call.findById(callId);

    if (!call) {
      return res.status(404).json({ msg: "Chamada não encontrada." });
    }

    // Apenas o chamador ou o receptor podem encerrar a chamada
    if (call.caller.toString() !== userId && call.receiver.toString() !== userId) {
      return res.status(403).json({ msg: "Você não tem permissão para encerrar esta chamada." });
    }

    call.status = "ended";
    call.endTime = new Date();
    await call.save();

    // Notificar o outro participante via Socket.IO que a chamada foi encerrada
    const otherParticipantId = call.caller.toString() === userId ? call.receiver.toString() : call.caller.toString();
    req.io.to(req.io.connectedUsers.get(otherParticipantId)).emit("call_ended", {
      callId: call._id,
      enderId: userId,
    });

    logger.info(`Chamada ${callId} encerrada por ${userId}.`);
    res.status(200).json({ msg: "Chamada encerrada com sucesso.", call });
  } catch (err) {
    logger.error(`Erro ao encerrar chamada: ${err.message}`);
    res.status(500).send("Erro no servidor ao encerrar chamada.");
  }
};

// Função para obter histórico de chamadas
exports.getCallHistory = async (req, res) => {
  const userId = req.user.id;

  try {
    const calls = await Call.find({
      $or: [{ caller: userId }, { receiver: userId }],
    })
      .populate("caller", "username")
      .populate("receiver", "username")
      .sort({ startTime: -1 });

    res.status(200).json(calls);
  } catch (err) {
    logger.error(`Erro ao obter histórico de chamadas: ${err.message}`);
    res.status(500).send("Erro no servidor ao obter histórico de chamadas.");
  }
};


