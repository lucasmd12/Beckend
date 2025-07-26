const QRR = require("../models/QRR");
const User = require("../models/User");
const Clan = require("../models/Clan");
const AutoNotificationService = require("../services/autoNotificationService");
const { authorizeQRRManager, authorizeQRRCreatorOrAdmin, authorizeClanLeaderOrAdmin } = require("../middleware/qrrAuthMiddleware");

/**
 * @swagger
 * /api/qrrs:
 *   post:
 *     summary: Criar um novo QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - clanId
 *               - startTime
 *               - endTime
 *             properties:
 *               title:
 *                 type: string
 *                 description: Título do QRR
 *               description:
 *                 type: string
 *                 description: Descrição do QRR
 *               imageUrl:
 *                 type: string
 *                 description: URL da imagem do QRR
 *                 nullable: true
 *               clanId:
 *                 type: string
 *                 description: ID do clã ao qual o QRR pertence
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: Hora de início do QRR (ISO 8601)
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: Hora de término do QRR (ISO 8601)
 *               type:
 *                 type: string
 *                 description: "Tipo do QRR (ex: quest, raid)"
 *                 nullable: true
 *               priority:
 *                 type: string
 *                 description: Prioridade do QRR
 *                 nullable: true
 *               maxParticipants:
 *                 type: integer
 *                 description: Número máximo de participantes
 *                 nullable: true
 *               requiredRoles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Funções necessárias para participar
 *                 nullable: true
 *               rewards:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                 description: Recompensas do QRR
 *                 nullable: true
 *               requirements:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Requisitos para o QRR
 *                 nullable: true
 *               metadata:
 *                 type: object
 *                 description: Metadados adicionais
 *                 nullable: true
 *               enemyClanId:
 *                 type: string
 *                 description: ID do clã inimigo (opcional)
 *                 nullable: true
 *               enemyClanFlagUrl:
 *                 type: string
 *                 description: URL da bandeira do clã inimigo (opcional)
 *                 nullable: true
 *     responses:
 *       201:
 *         description: QRR criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: "#/components/schemas/QRR"
 *       400:
 *         description: Erro de validação
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para criar QRR para este clã
 *       500:
 *         description: Erro no servidor
 */
exports.createQRR = [authorizeClanLeaderOrAdmin, async (req, res) => {
  const { title, description, imageUrl, clanId, startTime, endTime, type, priority, maxParticipants, requiredRoles, rewards, requirements, metadata, enemyClanId, enemyClanFlagUrl } = req.body;

  try {
    // A verificação de clã e permissão de líder/ADM já é feita pelo middleware authorizeClanLeaderOrAdmin
    const newQRR = new QRR({
      title,
      description,
      imageUrl,
      createdBy: req.user.id,
      clan: clanId,
      startTime,
      endTime,
      type,
      priority,
      maxParticipants,
      requiredRoles,
      rewards,
      requirements,
      metadata,
      enemyClanId,
      enemyClanFlagUrl,
    });

    const qrr = await newQRR.save();

    try {
      const createdByUser = await User.findById(req.user.id).select("username avatar");
      await AutoNotificationService.notifyNewQRR(qrr, createdByUser);
    } catch (notificationError) {
      console.error("Erro ao enviar notificação de nova QRR:", notificationError);
    }

    res.status(201).json({ success: true, data: qrr });
  } catch (error) {
    console.error("Erro ao criar QRR:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
}];

/**
 * @swagger
 * /api/qrrs/clan/{clanId}:
 *   get:
 *     summary: Obter todos os QRRs para um clã específico
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clanId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *     responses:
 *       200:
 *         description: Lista de QRRs do clã
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/QRR"
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
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

/**
 * @swagger
 * /api/qrrs/{id}:
 *   get:
 *     summary: Obter um único QRR por ID
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *     responses:
 *       200:
 *         description: Detalhes do QRR
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: "#/components/schemas/QRR"
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
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

/**
 * @swagger
 * /api/qrrs/{id}/status:
 *   put:
 *     summary: Atualizar o status de um QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, active, completed, cancelled, expired]
 *                 description: Novo status do QRR
 *     responses:
 *       200:
 *         description: Status do QRR atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: "#/components/schemas/QRR"
 *       400:
 *         description: Status inválido
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar o status deste QRR
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.updateQRRStatus = [authorizeQRRManager, async (req, res) => {
  const { status } = req.body;

  try {
    const qrr = await QRR.findById(req.params.id);
    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }

    // As verificações de permissão já são feitas pelo middleware authorizeQRRManager

    const oldStatus = qrr.status;
    qrr.status = status;
    await qrr.save();

    if (oldStatus !== status) {
      try {
        const updatedByUser = await User.findById(req.user.id).select("username avatar");
        await AutoNotificationService.notifyQRRStatusChange(qrr, status, updatedByUser);
      } catch (notificationError) {
        console.error("Erro ao enviar notificação de mudança de status:", notificationError);
      }
    }

    res.json({ success: true, data: qrr });
  } catch (error) {
    console.error("Erro ao atualizar status do QRR:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
}];

/**
 * @swagger
 * /api/qrrs/{id}:
 *   put:
 *     summary: Atualizar detalhes de um QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Novo título do QRR
 *               description:
 *                 type: string
 *                 description: Nova descrição do QRR
 *               imageUrl:
 *                 type: string
 *                 description: Nova URL da imagem do QRR
 *                 nullable: true
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: Nova hora de início do QRR (ISO 8601)
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: Nova hora de término do QRR (ISO 8601)
 *               type:
 *                 type: string
 *                 description: "Novo tipo do QRR (ex: quest, raid)"
 *                 nullable: true
 *               priority:
 *                 type: string
 *                 description: Nova prioridade do QRR
 *                 nullable: true
 *               maxParticipants:
 *                 type: integer
 *                 description: Novo número máximo de participantes
 *                 nullable: true
 *               requiredRoles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Novas funções necessárias para participar
 *                 nullable: true
 *               rewards:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                 description: Novas recompensas do QRR
 *                 nullable: true
 *               requirements:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Novos requisitos para o QRR
 *                 nullable: true
 *               metadata:
 *                 type: object
 *                 description: Novos metadados adicionais
 *                 nullable: true
 *               enemyClanId:
 *                 type: string
 *                 description: ID do clã inimigo (opcional)
 *                 nullable: true
 *               enemyClanFlagUrl:
 *                 type: string
 *                 description: URL da bandeira do clã inimigo (opcional)
 *                 nullable: true
 *     responses:
 *       200:
 *         description: QRR atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: "#/components/schemas/QRR"
 *       400:
 *         description: Erro de validação
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar este QRR
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.updateQRR = [authorizeQRRManager, async (req, res) => {
  const { title, description, imageUrl, startTime, endTime, type, priority, maxParticipants, requiredRoles, rewards, requirements, metadata, enemyClanId, enemyClanFlagUrl } = req.body;

  try {
    const qrr = await QRR.findById(req.params.id);
    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }

    // As verificações de permissão já são feitas pelo middleware authorizeQRRManager

    qrr.title = title || qrr.title;
    qrr.description = description || qrr.description;
    qrr.imageUrl = imageUrl || qrr.imageUrl;
    qrr.startTime = startTime || qrr.startTime;
    qrr.endTime = endTime || qrr.endTime;
    qrr.type = type || qrr.type;
    qrr.priority = priority || qrr.priority;
    qrr.maxParticipants = maxParticipants || qrr.maxParticipants;
    qrr.requiredRoles = requiredRoles || qrr.requiredRoles;
    qrr.rewards = rewards || qrr.rewards;
    qrr.requirements = requirements || qrr.requirements;
    qrr.metadata = metadata || qrr.metadata;
    qrr.enemyClanId = enemyClanId || qrr.enemyClanId;
    qrr.enemyClanFlagUrl = enemyClanFlagUrl || qrr.enemyClanFlagUrl;

    await qrr.save();
    res.json({ success: true, data: qrr });
  } catch (error) {
    console.error("Erro ao atualizar QRR:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
}];

/**
 * @swagger
 * /api/qrrs/{id}/join:
 *   post:
 *     summary: Entrar em um QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *     responses:
 *       200:
 *         description: Entrou no QRR com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: "#/components/schemas/QRR"
 *       400:
 *         description: Usuário já está no QRR ou QRR cheio
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não possui a função necessária para participar deste QRR
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.joinQRR = async (req, res) => {
  try {
    const qrr = await QRR.findById(req.params.id);
    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }

    if (qrr.participants.some(p => p.user.toString() === req.user.id)) {
      return res.status(400).json({ msg: "Você já está participando deste QRR." });
    }

    if (qrr.maxParticipants && qrr.participants.length >= qrr.maxParticipants) {
      return res.status(400).json({ msg: "Este QRR já atingiu o número máximo de participantes." });
    }

    if (qrr.requiredRoles && qrr.requiredRoles.length > 0) {
      const user = await User.findById(req.user.id);
      if (!user || !qrr.requiredRoles.includes(user.role)) {
        return res.status(403).json({ msg: "Você não possui a função necessária para participar deste QRR." });
      }
    }

    const joiningUser = await User.findById(req.user.id).select("username avatar role clanRole");
    qrr.participants.push({
      user: req.user.id,
      username: joiningUser.username,
      avatar: joiningUser.avatar,
      role: joiningUser.role,
      clanRole: joiningUser.clanRole,
    });
    await qrr.save();

    try {
      const creator = await User.findById(qrr.createdBy).select("username avatar");
      
      if (creator && creator._id.toString() !== req.user.id) {
        await AutoNotificationService.notifyQRRNewParticipant(qrr, joiningUser, creator);
      }
    } catch (notificationError) {
      console.error("Erro ao processar notificação de novo participante:", notificationError);
    }

    res.json({ success: true, msg: "Você entrou no QRR com sucesso!", data: qrr });
  } catch (error) {
    console.error("Erro ao entrar no QRR:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/qrrs/{id}/leave:
 *   post:
 *     summary: Sair de um QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *     responses:
 *       200:
 *         description: Saiu do QRR com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: "#/components/schemas/QRR"
 *       400:
 *         description: Usuário não está no QRR
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
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

    try {
      const leavingUser = await User.findById(req.user.id).select("username avatar");
      const creator = await User.findById(qrr.createdBy).select("username avatar");
      
      if (creator && creator._id.toString() !== req.user.id) {
        await AutoNotificationService.notifyQRRParticipantLeft(qrr, leavingUser, creator);
      }
    } catch (notificationError) {
      console.error("Erro ao processar notificação de participante que saiu:", notificationError);
    }

    res.json({ success: true, msg: "Você saiu do QRR com sucesso!", data: qrr });
  } catch (error) {
    console.error("Erro ao sair do QRR:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/qrrs/{id}/mark-present:
 *   post:
 *     summary: Marcar presença em um QRR (para líderes de clã/administradores)
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - isPresent
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID do usuário a ser marcado
 *               isPresent:
 *                 type: boolean
 *                 description: Status de presença (true para presente, false para ausente)
 *     responses:
 *       200:
 *         description: Presença marcada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: "#/components/schemas/QRR"
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para marcar presença neste QRR
 *       404:
 *         description: QRR ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.markPresence = [authorizeQRRManager, async (req, res) => {
  try {
    const { id: qrrId } = req.params;
    const { userId, isPresent } = req.body;

    const qrr = await QRR.findById(qrrId);
    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }

    // As verificações de permissão já são feitas pelo middleware authorizeQRRManager

    const participantIndex = qrr.participants.findIndex(p => p.user.toString() === userId);
    if (participantIndex === -1) {
      return res.status(404).json({ msg: "Participante não encontrado nesta QRR." });
    }

    qrr.participants[participantIndex].isPresent = isPresent;
    if (isPresent) {
      qrr.participants[participantIndex].markedPresentAt = new Date();
    } else {
      qrr.participants[participantIndex].markedPresentAt = undefined;
    }

    await qrr.save();

    try {
      const participant = await User.findById(userId).select("username avatar");
      const markedByUser = await User.findById(req.user.id).select("username avatar");
      
      if (participant && participant._id.toString() !== req.user.id) {
        await AutoNotificationService.notifyQRRPresenceMarked(qrr, participant, isPresent, markedByUser);
      }
    } catch (notificationError) {
      console.error("Erro ao processar notificação de presença marcada:", notificationError);
    }

    res.json({ 
      success: true, 
      msg: `Presença ${isPresent ? "confirmada" : "removida"} com sucesso!`,
      data: qrr 
    });
  } catch (error) {
    console.error("Erro ao marcar presença:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
}];

/**
 * @swagger
 * /api/qrrs/{id}/participant/{userId}/performance:
 *   put:
 *     summary: Atualizar o desempenho de um participante em um QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do participante
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               performanceData:
 *                 type: string
 *                 description: Descrição do desempenho do participante
 *     responses:
 *       200:
 *         description: Desempenho do participante atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: "#/components/schemas/QRR"
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar o desempenho neste QRR
 *       404:
 *         description: QRR ou participante não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.updateParticipantPerformance = [authorizeQRRManager, async (req, res) => {
  try {
    const { id: qrrId, userId } = req.params;
    const { performanceData } = req.body;

    const qrr = await QRR.findById(qrrId);
    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }

    // As verificações de permissão já são feitas pelo middleware authorizeQRRManager

    const participantIndex = qrr.participants.findIndex(p => p.user.toString() === userId);
    if (participantIndex === -1) {
      return res.status(404).json({ msg: "Participante não encontrado nesta QRR." });
    }

    qrr.participants[participantIndex].performance = performanceData;

    await qrr.save();

    res.json({ success: true, msg: "Desempenho do participante atualizado com sucesso!", data: qrr });
  } catch (error) {
    console.error("Erro ao atualizar desempenho do participante:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
}];

/**
 * @swagger
 * /api/qrrs/{id}/complete:
 *   post:
 *     summary: Concluir um QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - success
 *             properties:
 *               success:
 *                 type: boolean
 *                 description: Indica se o QRR foi concluído com sucesso
 *               notes:
 *                 type: string
 *                 description: Notas adicionais sobre a conclusão do QRR
 *                 nullable: true
 *               evidenceUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: URLs de evidências da conclusão do QRR
 *                 nullable: true
 *               metrics:
 *                 type: object
 *                 description: Métricas adicionais da conclusão do QRR
 *                 nullable: true
 *     responses:
 *       200:
 *         description: QRR concluído com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: "#/components/schemas/QRR"
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para concluir este QRR
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.completeQRR = [authorizeQRRManager, async (req, res) => {
  try {
    const { id: qrrId } = req.params;
    const { success, notes, evidenceUrls, metrics } = req.body;

    const qrr = await QRR.findById(qrrId);
    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }

    // As verificações de permissão já são feitas pelo middleware authorizeQRRManager

    qrr.status = "completed";
    qrr.result = {
      success,
      notes,
      evidenceUrls,
      metrics,
      completedAt: new Date(),
      completedBy: req.user.id,
    };

    await qrr.save();

    try {
      const completedByUser = await User.findById(req.user.id).select("username avatar");
      await AutoNotificationService.notifyQRRCompletion(qrr, completedByUser);
    } catch (notificationError) {
      console.error("Erro ao enviar notificação de conclusão de QRR:", notificationError);
    }

    res.json({ success: true, msg: "QRR concluído com sucesso!", data: qrr });
  } catch (error) {
    console.error("Erro ao concluir QRR:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
}];

/**
 * @swagger
 * /api/qrrs/{id}/cancel:
 *   post:
 *     summary: Cancelar um QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR
 *     responses:
 *       200:
 *         description: QRR cancelado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: "#/components/schemas/QRR"
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para cancelar este QRR
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.cancelQRR = [authorizeQRRManager, async (req, res) => {
  try {
    const { id: qrrId } = req.params;

    const qrr = await QRR.findById(qrrId);
    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }

    // As verificações de permissão já são feitas pelo middleware authorizeQRRManager

    qrr.status = "cancelled";
    await qrr.save();

    try {
      const cancelledByUser = await User.findById(req.user.id).select("username avatar");
      await AutoNotificationService.notifyQRRStatusChange(qrr, "cancelled", cancelledByUser);
    } catch (notificationError) {
      console.error("Erro ao enviar notificação de cancelamento de QRR:", notificationError);
    }

    res.json({ success: true, msg: "QRR cancelado com sucesso!", data: qrr });
  } catch (error) {
    console.error("Erro ao cancelar QRR:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
}];

/**
 * @swagger
 * /api/qrrs/{id}:
 *   delete:
 *     summary: Deletar um QRR
 *     tags: [QRR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do QRR a ser deletado
 *     responses:
 *       200:
 *         description: QRR deletado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para deletar este QRR
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.deleteQRR = [authorizeQRRCreatorOrAdmin, async (req, res) => {
  try {
    const { id: qrrId } = req.params;

    const qrr = await QRR.findById(qrrId);
    if (!qrr) {
      return res.status(404).json({ msg: "QRR não encontrado." });
    }

    // A verificação de permissão será feita pelo middleware authorizeQRRCreatorOrAdmin
    // antes desta função ser executada.

    if (qrr.participants.length > 0) {
      try {
        const deletedByUser = await User.findById(req.user.id).select("username avatar");
        // Notificação de cancelamento, pois o QRR será deletado e não mais acessível
        await AutoNotificationService.notifyQRRStatusChange(qrr, "cancelled", deletedByUser);
      } catch (notificationError) {
        console.error("Erro ao enviar notificação de QRR deletada:", notificationError);
      }
    }

    await qrr.deleteOne();
    res.json({ success: true, msg: "QRR deletado com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar QRR:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
}];


// @desc    Accept a federation QRR for a clan
// @route   PUT /api/qrrs/:id/accept-for-clan/:clanId
// @access  Private (Clan Leader or ADM)
exports.acceptQRRForClan = [authorizeClanLeaderOrAdmin, async (req, res) => {
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

    // A verificação de permissão (líder do clã ou ADM) será feita pelo middleware authorizeClanLeaderOrAdmin
    // antes desta função ser executada.
    const clan = await Clan.findById(clanId); // Ainda precisamos do clã para associar o QRR
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado." });
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
      const acceptedByUser = await User.findById(req.user.id).select("username avatar");
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
}];

// @desc    Reject a federation QRR for a clan
// @route   PUT /api/qrrs/:id/reject-for-clan/:clanId
// @access  Private (Clan Leader or ADM)
exports.rejectQRRForClan = [authorizeClanLeaderOrAdmin, async (req, res) => {
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

    // A verificação de permissão (líder do clã ou ADM) será feita pelo middleware authorizeClanLeaderOrAdmin
    // antes desta função ser executada.
    const clan = await Clan.findById(clanId); // Ainda precisamos do clã para associar o QRR
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado." });
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
}];

// @desc    Get QRRs available for a clan (including federation QRRs)
// @route   GET /api/qrrs/available/:clanId
// @access  Private
exports.getAvailableQRRsForClan = async (req, res) => {
  try {
    const { clanId } = req.params;

    const clan = await Clan.findById(clanId).populate("federation");
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
    }
    );
  } catch (error) {
    console.error("Erro ao obter QRRs disponíveis para clã:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// Exporta as funções do controlador
module.exports = {
  createQRR: exports.createQRR,
  getQRRsByClan: exports.getQRRsByClan,
  getQRRById: exports.getQRRById,
  updateQRRStatus: exports.updateQRRStatus,
  updateQRR: exports.updateQRR,
  joinQRR: exports.joinQRR,
  leaveQRR: exports.leaveQRR,
  markPresence: exports.markPresence,
  updateParticipantPerformance: exports.updateParticipantPerformance,
  completeQRR: exports.completeQRR,
  cancelQRR: exports.cancelQRR,
  deleteQRR: exports.deleteQRR,
  acceptQRRForClan: exports.acceptQRRForClan,
  rejectQRRForClan: exports.rejectQRRForClan,
  getAvailableQRRsForClan: exports.getAvailableQRRsForClan,
};




