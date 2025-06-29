const QRR = require(\"../models/QRR\");
const User = require(\"../models/User\");
const Clan = require(\"../models/Clan\");
const AutoNotificationService = require(\"../services/autoNotificationService\");

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
 *                 description: Tipo do QRR (ex: quest, raid)
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
 *                   $ref: \"#/components/schemas/QRR\"
 *       400:
 *         description: Erro de validação
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para criar QRR para este clã
 *       500:
 *         description: Erro no servidor
 */
exports.createQRR = async (req, res) => {
  const { title, description, imageUrl, clanId, startTime, endTime, type, priority, maxParticipants, requiredRoles, rewards, requirements, metadata } = req.body;

  try {
    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({ msg: \"Clã não encontrado.\" });
    }

    const isLeader = clan.leader && clan.leader.toString() === req.user.id;
    const isAdmin = req.user.role === \"ADM\";

    if (!isLeader && !isAdmin) {
      return res.status(403).json({ msg: \"Acesso negado. Apenas o líder do clã ou ADM pode criar QRR.\" });
    }

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
    });

    const qrr = await newQRR.save();

    try {
      const createdByUser = await User.findById(req.user.id).select(\"username avatar\");
      await AutoNotificationService.notifyNewQRR(qrr, createdByUser);
    } catch (notificationError) {
      console.error(\"Erro ao enviar notificação de nova QRR:\", notificationError);
    }

    res.status(201).json({ success: true, data: qrr });
  } catch (error) {
    console.error(\"Erro ao criar QRR:\", error);
    res.status(500).json({ msg: \"Erro interno do servidor.\" });
  }
};

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
 *                     $ref: \"#/components/schemas/QRR\"
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
      .populate(\"createdBy\", \"username avatar\")
      .populate(\"participants.user\", \"username avatar\");
    res.json({ success: true, data: qrrs });
  } catch (error) {
    console.error(\"Erro ao obter QRRs por clã:\", error);
    res.status(500).json({ msg: \"Erro interno do servidor.\" });
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
 *                   $ref: \"#/components/schemas/QRR\"
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
      .populate(\"createdBy\", \"username avatar\")
      .populate(\"participants.user\", \"username avatar\");

    if (!qrr) {
      return res.status(404).json({ msg: \"QRR não encontrado.\" });
    }
    res.json({ success: true, data: qrr });
  } catch (error) {
    console.error(\"Erro ao obter QRR:\", error);
    res.status(500).json({ msg: \"Erro interno do servidor.\" });
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
 *                   $ref: \"#/components/schemas/QRR\"
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
exports.updateQRRStatus = async (req, res) => {
  const { status } = req.body;

  try {
    const qrr = await QRR.findById(req.params.id);
    if (!qrr) {
      return res.status(404).json({ msg: \"QRR não encontrado.\" });
    }

    const isCreator = qrr.createdBy.toString() === req.user.id;
    const clan = await Clan.findById(qrr.clan);
    const isLeader = clan && clan.leader.toString() === req.user.id;
    const isAdmin = req.user.role === \"ADM\";

    if (!isCreator && !isLeader && !isAdmin) {
      return res.status(403).json({ msg: \"Acesso negado. Permissão insuficiente para atualizar o status do QRR.\" });
    }

    const oldStatus = qrr.status;
    qrr.status = status;
    await qrr.save();

    if (oldStatus !== status) {
      try {
        const updatedByUser = await User.findById(req.user.id).select(\"username avatar\");
        await AutoNotificationService.notifyQRRStatusChange(qrr, status, updatedByUser);
      } catch (notificationError) {
        console.error(\"Erro ao enviar notificação de mudança de status:\", notificationError);
      }
    }

    res.json({ success: true, data: qrr });
  } catch (error) {
    console.error(\"Erro ao atualizar status do QRR:\", error);
    res.status(500).json({ msg: \"Erro interno do servidor.\" });
  }
};

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
 *                 description: Novo tipo do QRR (ex: quest, raid)
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
 *                   $ref: \"#/components/schemas/QRR\"
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
exports.updateQRR = async (req, res) => {
  const { title, description, imageUrl, startTime, endTime, type, priority, maxParticipants, requiredRoles, rewards, requirements, metadata } = req.body;

  try {
    const qrr = await QRR.findById(req.params.id);
    if (!qrr) {
      return res.status(404).json({ msg: \"QRR não encontrado.\" });
    }

    const isCreator = qrr.createdBy.toString() === req.user.id;
    const clan = await Clan.findById(qrr.clan);
    const isLeader = clan && clan.leader.toString() === req.user.id;
    const isAdmin = req.user.role === \"ADM\";

    if (!isCreator && !isLeader && !isAdmin) {
      return res.status(403).json({ msg: \"Acesso negado. Permissão insuficiente para atualizar o QRR.\" });
    }

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

    await qrr.save();
    res.json({ success: true, data: qrr });
  } catch (error) {
    console.error(\"Erro ao atualizar QRR:\", error);
    res.status(500).json({ msg: \"Erro interno do servidor.\" });
  }
};

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
 *                   $ref: \"#/components/schemas/QRR\"
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
      return res.status(404).json({ msg: \"QRR não encontrado.\" });
    }

    if (qrr.participants.some(p => p.user.toString() === req.user.id)) {
      return res.status(400).json({ msg: \"Você já está participando deste QRR.\" });
    }

    if (qrr.maxParticipants && qrr.participants.length >= qrr.maxParticipants) {
      return res.status(400).json({ msg: \"Este QRR já atingiu o número máximo de participantes.\" });
    }

    if (qrr.requiredRoles && qrr.requiredRoles.length > 0) {
      const user = await User.findById(req.user.id);
      if (!user || !qrr.requiredRoles.includes(user.role)) {
        return res.status(403).json({ msg: \"Você não possui a função necessária para participar deste QRR.\" });
      }
    }

    const joiningUser = await User.findById(req.user.id).select(\"username avatar role clanRole\");
    qrr.participants.push({
      user: req.user.id,
      username: joiningUser.username,
      avatar: joiningUser.avatar,
      role: joiningUser.role,
      clanRole: joiningUser.clanRole,
    });
    await qrr.save();

    try {
      const creator = await User.findById(qrr.createdBy).select(\"username avatar\");
      
      if (creator && creator._id.toString() !== req.user.id) {
        await AutoNotificationService.notifyQRRNewParticipant(qrr, joiningUser, creator);
      }
    } catch (notificationError) {
      console.error(\"Erro ao processar notificação de novo participante:\", notificationError);
    }

    res.json({ success: true, msg: \"Você entrou no QRR com sucesso!\", data: qrr });
  } catch (error) {
    console.error(\"Erro ao entrar no QRR:\", error);
    res.status(500).json({ msg: \"Erro interno do servidor.\" });
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
 *                   $ref: \"#/components/schemas/QRR\"
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
      return res.status(404).json({ msg: \"QRR não encontrado.\" });
    }

    const initialLength = qrr.participants.length;
    qrr.participants = qrr.participants.filter(p => p.user.toString() !== req.user.id);

    if (qrr.participants.length === initialLength) {
      return res.status(400).json({ msg: \"Você não está participando deste QRR.\" });
    }

    await qrr.save();

    try {
      const leavingUser = await User.findById(req.user.id).select(\"username avatar\");
      const creator = await User.findById(qrr.createdBy).select(\"username avatar\");
      
      if (creator && creator._id.toString() !== req.user.id) {
        await AutoNotificationService.notifyQRRParticipantLeft(qrr, leavingUser, creator);
      }
    } catch (notificationError) {
      console.error(\"Erro ao processar notificação de participante que saiu:\", notificationError);
    }

    res.json({ success: true, msg: \"Você saiu do QRR com sucesso!\", data: qrr });
  } catch (error) {
    console.error(\"Erro ao sair do QRR:\", error);
    res.status(500).json({ msg: \"Erro interno do servidor.\" });
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
 *                   $ref: \"#/components/schemas/QRR\"
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
exports.markPresence = async (req, res) => {
  try {
    const { id: qrrId } = req.params;
    const { userId, isPresent } = req.body;

    const qrr = await QRR.findById(qrrId);
    if (!qrr) {
      return res.status(404).json({ msg: \"QRR não encontrado.\" });
    }

    const isCreator = qrr.createdBy.toString() === req.user.id;
    const clan = await Clan.findById(qrr.clan);
    const isLeader = clan && clan.leader.toString() === req.user.id;
    const isAdmin = req.user.role === \"ADM\";

    if (!isCreator && !isLeader && !isAdmin) {
      return res.status(403).json({ msg: \"Acesso negado. Permissão insuficiente para marcar presença.\" });
    }

    const participantIndex = qrr.participants.findIndex(p => p.user.toString() === userId);
    if (participantIndex === -1) {
      return res.status(404).json({ msg: \"Participante não encontrado nesta QRR.\" });
    }

    qrr.participants[participantIndex].isPresent = isPresent;
    if (isPresent) {
      qrr.participants[participantIndex].markedPresentAt = new Date();
    } else {
      qrr.participants[participantIndex].markedPresentAt = undefined;
    }

    await qrr.save();

    try {
      const participant = await User.findById(userId).select(\"username avatar\");
      const markedByUser = await User.findById(req.user.id).select(\"username avatar\");
      
      if (participant && participant._id.toString() !== req.user.id) {
        await AutoNotificationService.notifyQRRPresenceMarked(qrr, participant, isPresent, markedByUser);
      }
    } catch (notificationError) {
      console.error(\"Erro ao processar notificação de presença marcada:\", notificationError);
    }

    res.json({ 
      success: true, 
      msg: `Presença ${isPresent ? \"confirmada\" : \"removida\"} com sucesso!`,
      data: qrr 
    });
  } catch (error) {
    console.error(\"Erro ao marcar presença:\", error);
    res.status(500).json({ msg: \"Erro interno do servidor.\" });
  }
};

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
 *                   $ref: \"#/components/schemas/QRR\"
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
exports.updateParticipantPerformance = async (req, res) => {
  try {
    const { id: qrrId, userId } = req.params;
    const { performanceData } = req.body;

    const qrr = await QRR.findById(qrrId);
    if (!qrr) {
      return res.status(404).json({ msg: \"QRR não encontrado.\" });
    }

    const isCreator = qrr.createdBy.toString() === req.user.id;
    const clan = await Clan.findById(qrr.clan);
    const isLeader = clan && clan.leader.toString() === req.user.id;
    const isAdmin = req.user.role === \"ADM\";

    if (!isCreator && !isLeader && !isAdmin) {
      return res.status(403).json({ msg: \"Acesso negado. Permissão insuficiente para atualizar o desempenho do participante.\" });
    }

    const participantIndex = qrr.participants.findIndex(p => p.user.toString() === userId);
    if (participantIndex === -1) {
      return res.status(404).json({ msg: \"Participante não encontrado nesta QRR.\" });
    }

    qrr.participants[participantIndex].performance = performanceData;

    await qrr.save();

    res.json({ success: true, msg: \"Desempenho do participante atualizado com sucesso!\", data: qrr });
  } catch (error) {
    console.error(\"Erro ao atualizar desempenho do participante:\", error);
    res.status(500).json({ msg: \"Erro interno do servidor.\" });
  }
};

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
 *                   $ref: \"#/components/schemas/QRR\"
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
exports.completeQRR = async (req, res) => {
  try {
    const { id: qrrId } = req.params;
    const { success, notes, evidenceUrls, metrics } = req.body;

    const qrr = await QRR.findById(qrrId);
    if (!qrr) {
      return res.status(404).json({ msg: \"QRR não encontrado.\" });
    }

    const isCreator = qrr.createdBy.toString() === req.user.id;
    const clan = await Clan.findById(qrr.clan);
    const isLeader = clan && clan.leader.toString() === req.user.id;
    const isAdmin = req.user.role === \"ADM\";

    if (!isCreator && !isLeader && !isAdmin) {
      return res.status(403).json({ msg: \"Acesso negado. Permissão insuficiente para completar o QRR.\" });
    }

    qrr.status = \"completed\";
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
      const completedByUser = await User.findById(req.user.id).select(\"username avatar\");
      await AutoNotificationService.notifyQRRCompletion(qrr, completedByUser);
    } catch (notificationError) {
      console.error(\"Erro ao enviar notificação de conclusão de QRR:\", notificationError);
    }

    res.json({ success: true, msg: \"QRR concluído com sucesso!\", data: qrr });
  } catch (error) {
    console.error(\"Erro ao concluir QRR:\", error);
    res.status(500).json({ msg: \"Erro interno do servidor.\" });
  }
};

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
 *                   $ref: \"#/components/schemas/QRR\"
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para cancelar este QRR
 *       404:
 *         description: QRR não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.cancelQRR = async (req, res) => {
  try {
    const { id: qrrId } = req.params;

    const qrr = await QRR.findById(qrrId);
    if (!qrr) {
      return res.status(404).json({ msg: \"QRR não encontrado.\" });
    }

    const isCreator = qrr.createdBy.toString() === req.user.id;
    const clan = await Clan.findById(qrr.clan);
    const isLeader = clan && clan.leader.toString() === req.user.id;
    const isAdmin = req.user.role === \"ADM\";

    if (!isCreator && !isLeader && !isAdmin) {
      return res.status(403).json({ msg: \"Acesso negado. Permissão insuficiente para cancelar o QRR.\" });
    }

    qrr.status = \"cancelled\";
    await qrr.save();

    try {
      const cancelledByUser = await User.findById(req.user.id).select(\"username avatar\");
      await AutoNotificationService.notifyQRRStatusChange(qrr, \"cancelled\", cancelledByUser);
    } catch (notificationError) {
      console.error(\"Erro ao enviar notificação de cancelamento de QRR:\", notificationError);
    }

    res.json({ success: true, msg: \"QRR cancelado com sucesso!\", data: qrr });
  } catch (error) {
    console.error(\"Erro ao cancelar QRR:\", error);
    res.status(500).json({ msg: \"Erro interno do servidor.\" });
  }
};

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
exports.deleteQRR = async (req, res) => {
  try {
    const { id: qrrId } = req.params;

    const qrr = await QRR.findById(qrrId);
    if (!qrr) {
      return res.status(404).json({ msg: \"QRR não encontrado.\" });
    }

    const isCreator = qrr.createdBy.toString() === req.user.id;
    const clan = await Clan.findById(qrr.clan);
    const isLeader = clan && clan.leader.toString() === req.user.id;
    const isAdmin = req.user.role === \"ADM\";

    if (!isCreator && !isLeader && !isAdmin) {
      return res.status(403).json({ msg: \"Acesso negado. Permissão insuficiente para deletar o QRR.\" });
    }

    if (qrr.participants.length > 0) {
      try {
        const deletedByUser = await User.findById(req.user.id).select(\"username avatar\");
        await AutoNotificationService.notifyQRRStatusChange(qrr, \"cancelled\", deletedByUser);
      } catch (notificationError) {
        console.error(\"Erro ao enviar notificação de QRR deletada:\", notificationError);
      }
    }

    await qrr.deleteOne();
    res.json({ success: true, msg: \"QRR deletado com sucesso!\" });
  } catch (error) {
    console.error(\"Erro ao deletar QRR:\", error);
    res.status(500).json({ msg: \"Erro interno do servidor.\" });
  }
};


