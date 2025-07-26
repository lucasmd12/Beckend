const Call = require("../models/Call");
const CallHistory = require("../models/CallHistory");
const User = require("../models/User");
const logger = require("../utils/logger");
const generateJitsiToken = require("../utils/jitsiToken");

// Função auxiliar para obter o socket.io instance
const getSocketIO = (req) => {
  return req.app.get('socketio');
};



/**
 * @swagger
 * tags:
 *   name: VoIP
 *   description: Operações relacionadas a chamadas de voz e vídeo (VoIP)
 */

/**
 * @swagger
 * /api/voip/initiate-call:
 *   post:
 *     summary: Iniciar uma chamada de voz/vídeo 1x1
 *     tags: [VoIP]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiverId
 *               - callType
 *             properties:
 *               receiverId:
 *                 type: string
 *                 description: ID do usuário que receberá a chamada
 *               callType:
 *                 type: string
 *                 enum: [voice, video]
 *                 description: Tipo da chamada (voz ou vídeo)
 *     responses:
 *       200:
 *         description: Chamada iniciada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 callId:
 *                   type: string
 *                 roomName:
 *                   type: string
 *                 jitsiToken:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Chamador ou receptor não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.initiateCall = async (req, res) => {
  const { receiverId, callType } = req.body;
  const callerId = req.user.id;

  try {
    const caller = await User.findById(callerId);
    const receiver = await User.findById(receiverId);

    if (!caller || !receiver) {
      return res.status(404).json({ msg: "Chamador ou receptor não encontrado." });
    }

    // Criar uma chamada privada usando o modelo Call
    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newCall = new Call({
      createdBy: callerId,
      type: "private",
      participants: [
        { user: callerId, isSpeaker: true },
        { user: receiverId, isSpeaker: true }
      ],
      userLimit: 2,
      speakerLimit: 2,
      status: "pending",
      startTime: new Date(),
      callId: callId
    });

    await newCall.save();

    // Registrar no histórico de chamadas
    const newCallHistory = new CallHistory({
      callerId: callerId,
      receiverId: receiverId,
      callType: callType,
      status: "pending",
      roomId: newCall._id.toString(),
    });
    await newCallHistory.save();

    const callerJitsiToken = generateJitsiToken(caller, newCall._id.toString());

    const presenceService = require("../services/presenceService"); // Importar presenceService

    // Obter Socket.IO e o socket do receptor via presenceService
    const io = getSocketIO(req);
    const receiverSocketId = await presenceService.getSocketId(receiverId);
    
    if (io && receiverSocketId) {
      io.to(receiverSocketId).emit("incoming_call", {
        callId: newCall._id,
        callerId: caller._id,
        callerUsername: caller.username,
        roomName: newCall._id.toString(),
        jitsiToken: generateJitsiToken(receiver, newCall._id.toString()),
        callType: callType
      });
    }

    logger.info(`Chamada iniciada por ${caller.username} para ${receiver.username}. Call ID: ${newCall._id}`);
    res.status(200).json({ 
      msg: "Chamada iniciada com sucesso.", 
      callId: newCall._id, 
      roomName: newCall._id.toString(), 
      jitsiToken: callerJitsiToken 
    });
  } catch (err) {
    logger.error(`Erro ao iniciar chamada: ${err.message}`);
    res.status(500).send("Erro no servidor ao iniciar chamada.");
  }
};

/**
 * @swagger
 * /api/voip/accept-call:
 *   post:
 *     summary: Aceitar uma chamada de voz/vídeo
 *     tags: [VoIP]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - callId
 *             properties:
 *               callId:
 *                 type: string
 *                 description: ID da chamada a ser aceita
 *     responses:
 *       200:
 *         description: Chamada aceita com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 call:
 *                   $ref: '#/components/schemas/Call'
 *                 roomName:
 *                   type: string
 *                 jitsiToken:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Não tem permissão para aceitar esta chamada
 *       404:
 *         description: Chamada não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.acceptCall = async (req, res) => {
  const { callId } = req.body;
  const userId = req.user.id;

  try {
    const call = await Call.findById(callId);
    const callHistory = await CallHistory.findOne({ roomId: callId });
    const accepter = await User.findById(userId);

    if (!call) {
      return res.status(404).json({ msg: "Chamada não encontrada." });
    }

    // Verificar se o usuário é um dos participantes
    const isParticipant = call.participants.some(p => p.user.toString() === userId);
    if (!isParticipant) {
      return res.status(403).json({ msg: "Você não tem permissão para aceitar esta chamada." });
    }

    call.status = "active";
    call.startTime = new Date(); // Atualizar para o momento real de início
    await call.save();

    if (callHistory) {
      callHistory.status = "completed";
      await callHistory.save();
    }

    const accepterJitsiToken = generateJitsiToken(accepter, call._id.toString());

    const presenceService = require("../services/presenceService"); // Importar presenceService

    // Obter Socket.IO e o socket do chamador via presenceService
    const io = getSocketIO(req);
    
    // Notificar o chamador
    const caller = call.participants.find(p => p.user.toString() !== userId);
    if (caller) {
      const callerSocketId = await presenceService.getSocketId(caller.user.toString());
      if (callerSocketId) {
        const callerUser = await User.findById(caller.user);
        io.to(callerSocketId).emit("call_accepted", {
          callId: call._id,
          accepterId: userId,
          roomName: call._id.toString(),
          jitsiToken: generateJitsiToken(callerUser, call._id.toString()),
        });
      }
    }

    logger.info(`Chamada ${callId} aceita por ${userId}.`);
    res.status(200).json({ 
      msg: "Chamada aceita com sucesso.", 
      call, 
      roomName: call._id.toString(), 
      jitsiToken: accepterJitsiToken 
    });
  } catch (err) {
    logger.error(`Erro ao aceitar chamada: ${err.message}`);
    res.status(500).send("Erro no servidor ao aceitar chamada.");
  }
};

/**
 * @swagger
 * /api/voip/reject-call:
 *   post:
 *     summary: Rejeitar uma chamada de voz/vídeo
 *     tags: [VoIP]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - callId
 *             properties:
 *               callId:
 *                 type: string
 *                 description: ID da chamada a ser rejeitada
 *     responses:
 *       200:
 *         description: Chamada rejeitada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 call:
 *                   $ref: '#/components/schemas/Call'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Não tem permissão para rejeitar esta chamada
 *       404:
 *         description: Chamada não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.rejectCall = async (req, res) => {
  const { callId } = req.body;
  const userId = req.user.id;

  try {
    const call = await Call.findById(callId);
    const callHistory = await CallHistory.findOne({ roomId: callId });

    const presenceService = require("../services/presenceService"); // Importar presenceService

    if (!call) {
      return res.status(404).json({ msg: "Chamada não encontrada." });
    }

    // Verificar se o usuário é um dos participantes e se ele é o receptor
    const isReceiver = call.participants.some(p => p.user.toString() === userId && p.user.toString() === call.participants[1].user.toString());
    if (!isReceiver) {
      return res.status(403).json({ msg: "Você não tem permissão para rejeitar esta chamada." });
    }

    call.status = "rejected";
    call.endTime = new Date();
    await call.save();

    if (callHistory) {
      callHistory.status = "declined";
      callHistory.duration = 0; // Chamada rejeitada, duração 0
      await callHistory.save();
    }

    // Notificar o chamador
    const callerParticipant = call.participants.find(p => p.user.toString() !== userId);
    if (callerParticipant) {
      const callerSocketId = await presenceService.getSocketId(callerParticipant.user.toString());
      if (callerSocketId) {
        getSocketIO(req).to(callerSocketId).emit("call_rejected", {
          callId: call._id,
          rejecterId: userId,
        });
      }
    }

    logger.info(`Chamada ${callId} rejeitada por ${userId}.`);
    res.status(200).json({ msg: "Chamada rejeitada com sucesso.", call });
  } catch (err) {
    logger.error(`Erro ao rejeitar chamada: ${err.message}`);
    res.status(500).send("Erro no servidor ao rejeitar chamada.");
  }
};

/**
 * @swagger
 * /api/voip/end-call:
 *   post:
 *     summary: Encerrar uma chamada de voz/vídeo
 *     tags: [VoIP]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - callId
 *             properties:
 *               callId:
 *                 type: string
 *                 description: ID da chamada a ser encerrada
 *     responses:
 *       200:
 *         description: Chamada encerrada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 call:
 *                   $ref: '#/components/schemas/Call'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Não tem permissão para encerrar esta chamada
 *       404:
 *         description: Chamada não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.endCall = async (req, res) => {
  const { callId } = req.body;
  const userId = req.user.id;

  try {
    const call = await Call.findById(callId);
    const callHistory = await CallHistory.findOne({ roomId: callId });

    const presenceService = require("../services/presenceService"); // Importar presenceService

    if (!call) {
      return res.status(404).json({ msg: "Chamada não encontrada." });
    }

    // Verificar se o usuário é um dos participantes
    const isParticipant = call.participants.some(p => p.user.toString() === userId);
    if (!isParticipant) {
      return res.status(403).json({ msg: "Você não tem permissão para encerrar esta chamada." });
    }

    call.status = "ended";
    call.endTime = new Date();
    await call.save();

    if (callHistory) {
      callHistory.status = "completed";
      callHistory.duration = (new Date() - callHistory.timestamp) / 1000; // Duração em segundos
      await callHistory.save();
    }

    // Notificar o outro participante
    const otherParticipant = call.participants.find(p => p.user.toString() !== userId);
    if (otherParticipant) {
      const otherParticipantSocketId = await presenceService.getSocketId(otherParticipant.user.toString());
      if (otherParticipantSocketId) {
        getSocketIO(req).to(otherParticipantSocketId).emit("call_ended", {
          callId: call._id,
          enderId: userId,
        });
      }
    }

    logger.info(`Chamada ${callId} encerrada por ${userId}.`);
    res.status(200).json({ msg: "Chamada encerrada com sucesso.", call });
  } catch (err) {
    logger.error(`Erro ao encerrar chamada: ${err.message}`);
    res.status(500).send("Erro no servidor ao encerrar chamada.");
  }
};

/**
 * @swagger
 * /api/voip/call-history:
 *   get:
 *     summary: Obter histórico de chamadas do usuário autenticado
 *     tags: [VoIP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clanId
 *         schema:
 *           type: string
 *         description: Opcional. Filtra o histórico de chamadas por ID do clã.
 *       - in: query
 *         name: federationId
 *         schema:
 *           type: string
 *         description: Opcional. Filtra o histórico de chamadas por ID da federação.
 *     responses:
 *       200:
 *         description: Histórico de chamadas retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CallHistory'
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro no servidor
 */
exports.getCallHistory = async (req, res) => {
  const userId = req.user.id;
  const { clanId, federationId } = req.query;

  try {
    let query = {
      $or: [{ callerId: userId }, { receiverId: userId }],
    };

    if (clanId) {
      query.clanId = clanId;
    }
    if (federationId) {
      query.federationId = federationId;
    }

    const calls = await CallHistory.find(query)
      .populate("callerId", "username")
      .populate("receiverId", "username")
      .sort({ timestamp: -1 });

    res.status(200).json(calls);
  } catch (err) {
    logger.error(`Erro ao obter histórico de chamadas: ${err.message}`);
    res.status(500).send("Erro no servidor ao obter histórico de chamadas.");
  }
};

/**
 * @swagger
 * components:
 *   schemas:
 *     Call:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único da chamada
 *         caller:
 *           type: string
 *           description: ID do usuário que iniciou a chamada
 *         receiver:
 *           type: string
 *           description: ID do usuário que recebeu a chamada
 *         status:
 *           type: string
 *           enum: [pending, active, rejected, ended]
 *           description: Status atual da chamada
 *         startTime:
 *           type: string
 *           format: date-time
 *           description: Data e hora de início da chamada
 *         acceptedTime:
 *           type: string
 *           format: date-time
 *           description: Data e hora em que a chamada foi aceita (se aplicável)
 *           nullable: true
 *         endTime:
 *           type: string
 *           format: date-time
 *           description: Data e hora de término da chamada (se aplicável)
 *           nullable: true
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d1a"
 *         caller: "60d5ec49f8c7b7001c8e4d1b"
 *         receiver: "60d5ec49f8c7b7001c8e4d1c"
 *         status: "active"
 *         startTime: "2023-10-27T10:00:00Z"
 *         acceptedTime: "2023-10-27T10:00:05Z"
 *         endTime: "2023-10-27T10:10:00Z"
 *     CallHistory:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único do registro de histórico de chamada
 *         callerId:
 *           type: string
 *           description: ID do usuário que iniciou a chamada
 *         receiverId:
 *           type: string
 *           description: ID do usuário que recebeu a chamada
 *         callType:
 *           type: string
 *           enum: [voice, video]
 *           description: Tipo da chamada (voz ou vídeo)
 *         duration:
 *           type: number
 *           description: Duração da chamada em segundos
 *         status:
 *           type: string
 *           enum: [pending, completed, missed, declined, failed]
 *           description: Status da chamada
 *         roomId:
 *           type: string
 *           description: ID da sala Jitsi associada à chamada
 *         clanId:
 *           type: string
 *           description: ID do clã associado à chamada (opcional)
 *         federationId:
 *           type: string
 *           description: ID da federação associada à chamada (opcional)
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Data e hora do registro da chamada
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d1a"
 *         callerId: "60d5ec49f8c7b7001c8e4d1b"
 *         receiverId: "60d5ec49f8c7b7001c8e4d1c"
 *         callType: "voice"
 *         duration: 600
 *         status: "completed"
 *         roomId: "jitsi_room_123"
 *         timestamp: "2023-10-27T10:00:00Z"
 */
