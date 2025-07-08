const Channel = require("../models/Channel");
const User = require("../models/User");
const Message = require("../models/Message");
const Clan = require("../models/Clan");
const Federation = require("../models/Federation");
const { validationResult } = require("express-validator");

/**
 * @swagger
 * /api/channels:
 *   post:
 *     summary: Criar um novo canal
 *     tags: [Canais]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - channelType
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome do canal
 *               description:
 *                 type: string
 *                 description: Descrição do canal
 *               channelType:
 *                 type: string
 *                 enum: [global, federation, clan]
 *                 description: Tipo do canal (global, federation, clan)
 *               entityId:
 *                 type: string
 *                 description: ID da federação ou clã (obrigatório para channelType federation ou clan)
 *                 nullable: true
 *               mediaType:
 *                 type: string
 *                 enum: [voice, text]
 *                 description: Tipo de mídia do canal (voz ou texto)
 *               type:
 *                 type: string
 *                 enum: [public, private]
 *                 description: Visibilidade do canal (público ou privado)
 *               voiceSettings:
 *                 type: object
 *                 description: Configurações específicas para canais de voz
 *     responses:
 *       201:
 *         description: Canal criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 channel:
 *                   $ref: '#/components/schemas/Channel'
 *       400:
 *         description: Erro de validação ou canal já existe
 *       403:
 *         description: Não autorizado a criar o canal
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.createChannel = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, channelType, entityId, mediaType, type, voiceSettings } = req.body;

  try {
    const existingChannel = await Channel.findOne({ 
      name, 
      channelType, 
      entityId: entityId || null 
    });
    
    if (existingChannel) {
      return res.status(400).json({ 
        msg: `Já existe um canal com este nome no contexto ${channelType}` 
      });
    }

    const user = await User.findById(req.user.id).populate('clan').populate('federation');
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const permissionCheck = await validateChannelCreationPermission(user, channelType, entityId);
    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.message });
    }

    const channelData = {
      name,
      description: description || "",
      owner: req.user.id,
      channelType,
      entityId: entityId || null,
      mediaType: mediaType || "voice",
      type: type || "public",
      members: [req.user.id],
      voiceSettings: voiceSettings || {}
    };

    if (channelType === 'clan' && entityId) {
      channelData.clan = entityId;
    } else if (channelType === 'federation' && entityId) {
      channelData.federation = entityId;
    }

    const channel = new Channel(channelData);
    await channel.save();

    await channel.populate([
      { path: 'owner', select: 'username avatar' },
      { path: 'clan', select: 'name' },
      { path: 'federation', select: 'name' }
    ]);

    res.status(201).json({
      success: true,
      message: "Canal criado com sucesso",
      channel
    });
  } catch (err) {
    console.error("Create channel error:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

async function validateChannelCreationPermission(user, channelType, entityId) {
  if (user.role === "ADM") {
    return { allowed: true };
  }

  switch (channelType) {
    case 'global':
      return { allowed: true };

    case 'federation':
      if (!user.clan) {
        return { 
          allowed: false, 
          message: "Você precisa estar em um clã para criar canais na federação." 
        };
      }

      if (user.clanRole !== 'leader') {
        return { 
          allowed: false, 
          message: "Apenas líderes de clã podem criar canais na federação." 
        };
      }

      const clan = await Clan.findById(user.clan._id);
      if (!clan || clan.federation.toString() !== entityId) {
        return { 
          allowed: false, 
          message: "Seu clã não pertence a esta federação." 
        };
      }

      return { allowed: true };

    case 'clan':
      if (!user.clan) {
        return { 
          allowed: false, 
          message: "Você precisa estar em um clã para criar canais no clã." 
        };
      }

      if (!['leader', 'sub_leader'].includes(user.clanRole)) {
        return { 
          allowed: false, 
          message: "Apenas líderes e sub-líderes podem criar canais no clã." 
        };
      }

      if (user.clan._id.toString() !== entityId) {
        return { 
          allowed: false, 
          message: "Você só pode criar canais no seu próprio clã." 
        };
      }

      return { allowed: true };

    default:
      return { 
        allowed: false, 
        message: "Tipo de canal inválido. Use 'global', 'federation' ou 'clan'." 
      };
  }
}

/**
 * @swagger
 * /api/channels:
 *   get:
 *     summary: Obter canais por tipo e entidade
 *     tags: [Canais]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: channelType
 *         schema:
 *           type: string
 *           enum: [global, federation, clan]
 *         description: Tipo do canal para filtrar
 *       - in: query
 *         name: entityId
 *         schema:
 *           type: string
 *         description: ID da federação ou clã para filtrar (obrigatório para channelType federation ou clan)
 *       - in: query
 *         name: mediaType
 *         schema:
 *           type: string
 *           enum: [voice, text]
 *         description: Tipo de mídia do canal para filtrar
 *     responses:
 *       200:
 *         description: Lista de canais retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 channels:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Channel'
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro no servidor
 */
exports.getChannels = async (req, res) => {
  try {
    const { channelType, entityId, mediaType } = req.query;
    
    const filter = { isActive: true };
    
    if (channelType) {
      filter.channelType = channelType;
    }
    
    if (entityId) {
      filter.entityId = entityId;
    }
    
    if (mediaType) {
      filter.mediaType = mediaType;
    }

    const channels = await Channel.find(filter)
      .populate('owner', 'username avatar')
      .populate('clan', 'name')
      .populate('federation', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      channels
    });
  } catch (err) {
    console.error("Get channels error:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

/**
 * @swagger
 * /api/channels/{id}:
 *   get:
 *     summary: Obter detalhes de um canal por ID
 *     tags: [Canais]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do canal
 *     responses:
 *       200:
 *         description: Detalhes do canal retornados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 channel:
 *                   $ref: '#/components/schemas/Channel'
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Canal não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.getChannelById = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id)
      .populate("owner", "username avatar")
      .populate("members", "username avatar")
      .populate("clan", "name")
      .populate("federation", "name");

    if (!channel) {
      return res.status(404).json({ msg: "Canal não encontrado" });
    }

    res.json({
      success: true,
      channel
    });
  } catch (err) {
    console.error("Get channel by ID error:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Canal não encontrado" });
    }
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

/**
 * @swagger
 * /api/channels/allchannels:
 *   get:
 *     summary: Obter todos os canais (sem filtros)
 *     tags: [Canais]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de todos os canais retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 channels:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Channel'
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro no servidor
 */
exports.getAllChannelsExplicit = async (req, res) => {
  try {
    const channels = await Channel.find({ isActive: true })
      .populate('owner', 'username avatar')
      .populate('clan', 'name')
      .populate('federation', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, channels });
  } catch (err) {
    console.error('Get all channels error:', err.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * @swagger
 * /api/channels/{id}/join:
 *   post:
 *     summary: Entrar em um canal
 *     tags: [Canais]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do canal
 *     responses:
 *       200:
 *         description: Entrou no canal com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 msg:
 *                   type: string
 *                 members:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Já é membro do canal
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Canal não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.joinChannel = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id);

    if (!channel) {
      return res.status(404).json({ msg: "Canal não encontrado" });
    }

    if (channel.members.includes(req.user.id)) {
      return res.status(400).json({ msg: "Usuário já está neste canal" });
    }

    channel.members.push(req.user.id);
    await channel.save();

    res.json({ 
      success: true,
      msg: "Entrou no canal com sucesso", 
      members: channel.members 
    });
  } catch (err) {
    console.error("Join channel error:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Canal não encontrado" });
    }
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

/**
 * @swagger
 * /api/channels/{id}/leave:
 *   post:
 *     summary: Sair de um canal
 *     tags: [Canais]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do canal
 *     responses:
 *       200:
 *         description: Saiu do canal com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 msg:
 *                   type: string
 *                 members:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Não é membro do canal
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Canal não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.leaveChannel = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id);

    if (!channel) {
      return res.status(404).json({ msg: "Canal não encontrado" });
    }

    if (!channel.members.includes(req.user.id)) {
      return res.status(400).json({ msg: "Usuário não está neste canal" });
    }

    channel.members = channel.members.filter(
      (memberId) => !memberId.equals(req.user.id)
    );

    await channel.save();

    res.json({ 
      success: true,
      msg: "Saiu do canal com sucesso", 
      members: channel.members 
    });
  } catch (err) {
    console.error("Leave channel error:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Canal não encontrado" });
    }
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

/**
 * @swagger
 * /api/channels/{id}/messages:
 *   get:
 *     summary: Obter mensagens de um canal
 *     tags: [Canais]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do canal
 *     responses:
 *       200:
 *         description: Lista de mensagens do canal
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não é membro do canal
 *       404:
 *         description: Canal não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.getChannelMessages = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ msg: "Canal não encontrado" });
    }

    if (!channel.members.some(memberId => memberId.equals(req.user.id))) {
       return res.status(403).json({ msg: "Não autorizado a ver mensagens deste canal" });
    }

    const messages = await Message.find({ channel: req.params.id })
      .populate("sender", "username avatar")
      .sort({ timestamp: 1 });

    res.json({
      success: true,
      messages
    });
  } catch (err) {
    console.error("Get channel messages error:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Canal não encontrado" });
    }
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

/**
 * @swagger
 * /api/channels/{id}:
 *   put:
 *     summary: Atualizar um canal
 *     tags: [Canais]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do canal a ser atualizado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Novo nome do canal
 *               description:
 *                 type: string
 *                 description: Nova descrição do canal
 *               voiceSettings:
 *                 type: object
 *                 description: Novas configurações de voz do canal
 *               type:
 *                 type: string
 *                 enum: [public, private]
 *                 description: Nova visibilidade do canal
 *     responses:
 *       200:
 *         description: Canal atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 msg:
 *                   type: string
 *                 channel:
 *                   $ref: '#/components/schemas/Channel'
 *       400:
 *         description: Erro de validação ou nome do canal já em uso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar este canal
 *       404:
 *         description: Canal não encontrado
 *       500:
 *         description: Erro no servidor
 *   delete:
 *     summary: Deletar um canal
 *     tags: [Canais]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do canal a ser deletado
 *     responses:
 *       200:
 *         description: Canal e mensagens associadas deletados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 msg:
 *                   type: string
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para deletar este canal
 *       404:
 *         description: Canal não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.updateChannel = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, voiceSettings, type } = req.body;

  try {
    const channel = await Channel.findById(req.params.id);

    if (!channel) {
      return res.status(404).json({ msg: "Canal não encontrado" });
    }

    const user = await User.findById(req.user.id).populate('clan');
    const hasPermission = await validateChannelManagementPermission(user, channel);
    
    if (!hasPermission.allowed) {
      return res.status(403).json({ error: hasPermission.message });
    }

    if (name && name !== channel.name) {
      const existingChannel = await Channel.findOne({ 
        name, 
        channelType: channel.channelType, 
        entityId: channel.entityId 
      });
      if (existingChannel) {
        return res.status(400).json({ msg: "Nome do canal já está em uso neste contexto" });
      }
    }

    if (name) channel.name = name;
    if (description !== undefined) channel.description = description;
    if (voiceSettings) channel.voiceSettings = { ...channel.voiceSettings, ...voiceSettings };
    if (type) channel.type = type;

    await channel.save();

    res.json({ 
      success: true,
      msg: "Canal atualizado com sucesso", 
      channel 
    });
  } catch (err) {
    console.error("Update channel error:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Canal não encontrado" });
    }
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

exports.deleteChannel = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id);

    if (!channel) {
      return res.status(404).json({ msg: "Canal não encontrado" });
    }

    const user = await User.findById(req.user.id).populate('clan');
    const hasPermission = await validateChannelManagementPermission(user, channel);
    
    if (!hasPermission.allowed) {
      return res.status(403).json({ error: hasPermission.message });
    }

    await Message.deleteMany({ channel: req.params.id });

    await Channel.findByIdAndDelete(req.params.id);

    res.json({ 
      success: true,
      msg: "Canal e mensagens associadas deletados com sucesso" 
    });
  } catch (err) {
    console.error("Delete channel error:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Canal não encontrado" });
    }
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

async function validateChannelManagementPermission(user, channel) {
  if (user.role === "ADM") {
    return { allowed: true };
  }

  if (channel.owner.toString() === user._id.toString()) {
    return { allowed: true };
  }

  switch (channel.channelType) {
    case 'global':
      return { 
        allowed: false,
        message: "Apenas o proprietário do canal ou ADM podem gerenciar este canal." 
      };

    case 'federation':
      if (!user.clan || user.clanRole !== 'leader') {
        return { 
          allowed: false,
          message: "Apenas líderes de clã podem gerenciar canais da federação." 
        };
      }

      const clan = await Clan.findById(user.clan._id);
      if (!clan || clan.federation.toString() !== channel.entityId.toString()) {
        return { 
          allowed: false,
          message: "Você só pode gerenciar canais da sua federação." 
        };
      }

      return { allowed: true };

    case 'clan':
      if (!user.clan || !['leader', 'sub_leader'].includes(user.clanRole)) {
        return { 
          allowed: false,
          message: "Apenas líderes e sub-líderes podem gerenciar canais do clã." 
        };
      }

      if (user.clan._id.toString() !== channel.entityId.toString()) {
        return { 
          allowed: false,
          message: "Você só pode gerenciar canais do seu próprio clã." 
        };
      }

      return { allowed: true };

    default:
      return { 
        allowed: false,
        message: "Tipo de canal inválido." 
      };
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Channel:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único do canal
 *         name:
 *           type: string
 *           description: Nome do canal
 *         description:
 *           type: string
 *           description: Descrição do canal
 *           nullable: true
 *         owner:
 *           type: string
 *           description: ID do usuário proprietário do canal
 *         channelType:
 *           type: string
 *           enum: [global, federation, clan]
 *           description: Tipo do canal (global, federation, clan)
 *         entityId:
 *           type: string
 *           description: ID da federação ou clã associado (se aplicável)
 *           nullable: true
 *         mediaType:
 *           type: string
 *           enum: [voice, text]
 *           description: Tipo de mídia do canal (voz ou texto)
 *         type:
 *           type: string
 *           enum: [public, private]
 *           description: Visibilidade do canal (público ou privado)
 *         members:
 *           type: array
 *           items:
 *             type: string
 *           description: IDs dos membros do canal
 *         voiceSettings:
 *           type: object
 *           description: Configurações específicas para canais de voz
 *           properties:
 *             maxParticipants:
 *               type: number
 *               description: Número máximo de participantes em um canal de voz
 *             moderated:
 *               type: boolean
 *               description: Indica se o canal de voz é moderado
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data de criação do canal
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização do canal
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d1a"
 *         name: "Canal Geral"
 *         description: "Canal de comunicação geral"
 *         owner: "60d5ec49f8c7b7001c8e4d1b"
 *         channelType: "global"
 *         mediaType: "text"
 *         type: "public"
 *         members: ["60d5ec49f8c7b7001c8e4d1b", "60d5ec49f8c7b7001c8e4d1c"]
 *         createdAt: "2023-10-27T10:00:00Z"
 *         updatedAt: "2023-10-27T10:00:00Z"
 *     Message:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único da mensagem
 *         channel:
 *           type: string
 *           description: ID do canal ao qual a mensagem pertence
 *         sender:
 *           type: string
 *           description: ID do remetente da mensagem
 *         text:
 *           type: string
 *           description: Conteúdo da mensagem
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Data e hora do envio da mensagem
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d1d"
 *         channel: "60d5ec49f8c7b7001c8e4d1a"
 *         sender: "60d5ec49f8c7b7001c8e4d1b"
 *         text: "Olá a todos!"
 *         timestamp: "2023-10-27T10:05:00Z"
 */


