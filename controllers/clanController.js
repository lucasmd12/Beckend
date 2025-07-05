const Clan = require("../models/Clan");
const User = require("../models/User");
const Federation = require("../models/Federation");
const cacheService = require("../services/cacheService");
const CacheKeys = require("../utils/cacheKeys");

/**
 * @swagger
 * /api/clans:
 *   get:
 *     summary: Obter todos os clãs
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página para paginação
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Limite de itens por página
 *       - in: query
 *         name: federationId
 *         schema:
 *           type: string
 *         description: ID da federação para filtrar clãs
 *     responses:
 *       200:
 *         description: Lista de todos os clãs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pages:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/Clan"
 *                 cached:
 *                   type: boolean
 *                   description: Indica se a resposta veio do cache
 *                 cacheKey:
 *                   type: string
 *                   description: Chave do cache utilizada
 *       401:
 *         description: Não autorizado, token ausente ou inválido
 *       500:
 *         description: Erro no servidor
 */
exports.getClans = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const federationId = req.query.federationId || "all";
    const skip = (page - 1) * limit;

    const cacheKey = CacheKeys.clanList(`${federationId}_p${page}_l${limit}`);
    
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.json({
        ...cachedData,
        cached: true,
        cacheKey
      });
    }

    const filter = federationId !== "all" ? { federation: federationId } : {};

    const clans = await Clan.find(filter)
      .populate("leader", "username avatar")
      .populate("subLeaders", "username avatar")
      .populate("members", "username avatar")
      .populate("federation", "name")
      .lean()
      .skip(skip)
      .limit(limit);

    const totalClans = await Clan.countDocuments(filter);

    const responseData = {
      success: true,
      count: clans.length,
      total: totalClans,
      page,
      pages: Math.ceil(totalClans / limit),
      data: clans,
    };

    await cacheService.set(cacheKey, responseData, 1800);

    res.json(responseData);
  } catch (error) {
    console.error("Erro ao obter clãs:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}:
 *   get:
 *     summary: Obter um clã específico por ID
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *     responses:
 *       200:
 *         description: Detalhes do clã
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: "#/components/schemas/Clan"
 *                 cached:
 *                   type: boolean
 *                   description: Indica se a resposta veio do cache
 *                 cacheKey:
 *                   type: string
 *                   description: Chave do cache utilizada
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.getClanById = async (req, res) => {
  try {
    const clanId = req.params.id;
    
    const cacheKey = CacheKeys.clan(clanId);
    
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.json({
        ...cachedData,
        cached: true,
        cacheKey
      });
    }

    const clan = await Clan.findById(clanId)
      .populate("leader", "username avatar")
      .populate("subLeaders", "username avatar")
      .populate("members", "username avatar")
      .populate("federation", "name")
      .lean();
    
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    const responseData = {
      success: true,
      data: clan,
    };

    await cacheService.set(cacheKey, responseData, 1800);

    res.json(responseData);
  } catch (error) {
    console.error("Erro ao obter clã:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans:
 *   post:
 *     summary: Criar um novo clã
 *     tags: [Clãs]
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
 *               - tag
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome do clã
 *               tag:
 *                 type: string
 *                 description: Tag do clã (máximo 5 caracteres)
 *               description:
 *                 type: string
 *                 description: Descrição do clã
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Clã criado com sucesso
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
 *                   $ref: "#/components/schemas/Clan"
 *       400:
 *         description: "Erro de validação (ex: nome ou tag ausente, tag já em uso, usuário já pertence a um clã)"
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro no servidor
 */
exports.createClan = async (req, res) => {
  const { name, tag, description } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (user.clan) {
      return res.status(400).json({ msg: "Você já pertence a um clã." });
    }

    let clan = await Clan.findOne({ tag: tag.toUpperCase() });
    if (clan) {
      return res.status(400).json({ msg: "Esta tag já está em uso." });
    }

    clan = new Clan({
      name,
      tag: tag.toUpperCase(),
      description,
      leader: req.user.id,
      members: [req.user.id],
    });

    await clan.save();

    user.clan = clan._id;
    user.clanRole = "Leader";
    await user.save();

    res.status(201).json({ msg: "Clã criado com sucesso!", data: clan });
  } catch (error) {
    console.error("Erro ao criar clã:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/{id}:
 *   put:
 *     summary: Atualizar informações de um clã (Líder do Clã ou ADM)
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã a ser atualizado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Novo nome do clã
 *               description:
 *                 type: string
 *                 description: Nova descrição do clã
 *               rules:
 *                 type: string
 *                 description: Novas regras do clã
 *     responses:
 *       200:
 *         description: Clã atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: "#/components/schemas/Clan"
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar este clã
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.updateClan = async (req, res) => {
  const { name, description, rules } = req.body;
  const clan = req.clan;

  try {
    if (name) clan.name = name;
    if (description) clan.description = description;
    if (rules) clan.rules = rules;

    await clan.save();
    res.json({ success: true, data: clan });
  } catch (error) {
    console.error("Erro ao atualizar clã:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/banner:
 *   put:
 *     summary: Atualizar a bandeira (banner) de um clã
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               banner:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo de imagem para o banner (max 5MB)
 *     responses:
 *       200:
 *         description: Banner do clã atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 banner:
 *                   type: string
 *                   description: URL do novo banner
 *       400:
 *         description: "Requisição inválida (ex: nenhum arquivo, arquivo não é imagem, tamanho excedido)"
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar o banner deste clã
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.updateClanBanner = async (req, res) => {
  const clan = req.clan;

  try {
    if (!req.file) {
      return res.status(400).json({ msg: "Nenhum arquivo enviado" });
    }

    clan.banner = req.file.path;
    await clan.save();

    res.json({ success: true, banner: clan.banner });
  } catch (error) {
    console.error("Erro ao atualizar banner do clã:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/join:
 *   put:
 *     summary: Entrar em um clã
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *     responses:
 *       200:
 *         description: Entrou no clã com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Usuário já é membro do clã ou clã cheio
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.joinClan = async (req, res) => {
  const { id } = req.params;

  try {
    const clan = await Clan.findById(id);
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado." });
    }

    const user = await User.findById(req.user.id);
    if (user.clan) {
      return res.status(400).json({ msg: "Você já pertence a um clã." });
    }

    if (clan.members.includes(req.user.id)) {
      return res.status(400).json({ msg: "Você já é membro deste clã." });
    }

    clan.members.push(req.user.id);
    await clan.save();

    user.clan = clan._id;
    user.clanRole = "member";
    await user.save();

    res.json({ success: true, msg: "Entrou no clã com sucesso!" });
  } catch (error) {
    console.error("Erro ao entrar no clã:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/{id}/leave:
 *   put:
 *     summary: Sair de um clã
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *     responses:
 *       200:
 *         description: Saiu do clã com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Usuário não é membro do clã ou é o líder do clã
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.leaveClan = async (req, res) => {
  const { id } = req.params;

  try {
    const clan = await Clan.findById(id);
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado." });
    }

    const user = await User.findById(req.user.id);

    if (!clan.members.includes(req.user.id)) {
      return res.status(400).json({ msg: "Você não é membro deste clã." });
    }

    if (clan.leader.toString() === req.user.id) {
      return res.status(400).json({ msg: "Líder não pode sair do clã sem transferir a liderança primeiro." });
    }

    clan.members = clan.members.filter(member => member.toString() !== req.user.id);
    if (clan.subLeaders.includes(req.user.id)) {
      clan.subLeaders = clan.subLeaders.filter(subLeader => subLeader.toString() !== req.user.id);
    }
    await clan.save();

    user.clan = null;
    user.clanRole = null;
    await user.save();

    res.json({ success: true, msg: "Saiu do clã com sucesso!" });
  } catch (error) {
    console.error("Erro ao sair do clã:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/{id}/promote/{userId}:
 *   put:
 *     summary: Promover um membro a sub-líder (Líder do Clã ou ADM)
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser promovido
 *     responses:
 *       200:
 *         description: Membro promovido a sub-líder com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Usuário já é líder ou sub-líder, ou não é membro do clã
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para promover membros neste clã
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.promoteMember = async (req, res) => {
  const { userId } = req.params;
  const clan = req.clan;

  try {
    const userToPromote = await User.findById(userId);
    if (!userToPromote) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    if (!clan.members.includes(userId)) {
      return res.status(400).json({ msg: "Usuário não é membro deste clã." });
    }

    if (userToPromote.clanRole === "Leader" || userToPromote.clanRole === "SubLeader") {
      return res.status(400).json({ msg: "Usuário já é líder ou sub-líder." });
    }

    clan.subLeaders.push(userId);
    await clan.save();

    userToPromote.clanRole = "SubLeader";
    await userToPromote.save();

    res.json({ success: true, msg: "Membro promovido a sub-líder com sucesso!" });
  } catch (error) {
    console.error("Erro ao promover membro:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/{id}/demote/{userId}:
 *   put:
 *     summary: Rebaixar um sub-líder a membro comum (Líder do Clã ou ADM)
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser rebaixado
 *     responses:
 *       200:
 *         description: Sub-líder rebaixado a membro comum com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Usuário não é sub-líder
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para rebaixar membros neste clã
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.demoteMember = async (req, res) => {
  const { userId } = req.params;
  const clan = req.clan;

  try {
    const userToDemote = await User.findById(userId);
    if (!userToDemote) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    if (userToDemote.clanRole !== "SubLeader") {
      return res.status(400).json({ msg: "Usuário não é sub-líder." });
    }

    clan.subLeaders = clan.subLeaders.filter(subLeader => subLeader.toString() !== userId);
    await clan.save();

    userToDemote.clanRole = "member";
    await userToDemote.save();

    res.json({ success: true, msg: "Sub-líder rebaixado a membro comum com sucesso!" });
  } catch (error) {
    console.error("Erro ao rebaixar membro:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/{id}/transfer/{userId}:
 *   put:
 *     summary: Transferir liderança do clã (Líder do Clã ou ADM)
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário para quem a liderança será transferida
 *     responses:
 *       200:
 *         description: Liderança do clã transferida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Novo líder não é membro do clã
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para transferir liderança deste clã
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.transferLeadership = async (req, res) => {
  const { userId } = req.params;
  const clan = req.clan;

  try {
    const newLeader = await User.findById(userId);
    if (!newLeader) {
      return res.status(404).json({ msg: "Novo líder não encontrado." });
    }

    if (!clan.members.includes(userId)) {
      return res.status(400).json({ msg: "O novo líder deve ser um membro do clã." });
    }

    const oldLeader = await User.findById(clan.leader);
    if (oldLeader) {
      oldLeader.clanRole = "member";
      await oldLeader.save();
    }

    newLeader.clanRole = "Leader";
    await newLeader.save();

    clan.leader = userId;
    clan.subLeaders = clan.subLeaders.filter(subLeader => subLeader.toString() !== userId);
    await clan.save();

    res.json({ success: true, msg: "Liderança do clã transferida com sucesso!" });
  } catch (error) {
    console.error("Erro ao transferir liderança:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/{id}/kick/{userId}:
 *   put:
 *     summary: Expulsar um membro do clã (Líder ou Sub-líder do Clã ou ADM)
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser expulso
 *     responses:
 *       200:
 *         description: Membro expulso do clã com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Não é possível expulsar o líder do clã, ou usuário não é membro do clã
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para expulsar membros deste clã
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.kickMember = async (req, res) => {
  const { userId } = req.params;
  const clan = req.clan;

  try {
    const userToKick = await User.findById(userId);
    if (!userToKick) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    if (!clan.members.includes(userId)) {
      return res.status(400).json({ msg: "Usuário não é membro deste clã." });
    }

    if (clan.leader.toString() === userId) {
      return res.status(400).json({ msg: "Não é possível expulsar o líder do clã." });
    }

    clan.members = clan.members.filter(member => member.toString() !== userId);
    if (clan.subLeaders.includes(userId)) {
      clan.subLeaders = clan.subLeaders.filter(subLeader => subLeader.toString() !== userId);
    }
    await clan.save();

    userToKick.clan = null;
    userToKick.clanRole = null;
    await userToKick.save();

    res.json({ success: true, msg: "Membro expulso do clã com sucesso!" });
  } catch (error) {
    console.error("Erro ao expulsar membro:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/{id}:
 *   delete:
 *     summary: Deletar um clã (Líder do Clã ou ADM)
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã a ser deletado
 *     responses:
 *       200:
 *         description: Clã deletado com sucesso
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
 *         description: Proibido, usuário não tem permissão para deletar este clã
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.deleteClan = async (req, res) => {
  const clan = req.clan;

  try {
    await User.updateMany({ clan: clan._id }, { $set: { clan: null, clanRole: null } });

    if (clan.federation) {
      const federation = await Federation.findById(clan.federation);
      if (federation) {
        federation.clans = federation.clans.filter(c => c.toString() !== clan._id.toString());
        await federation.save();
      }
    }

    await clan.deleteOne();

    res.json({ success: true, msg: "Clã deletado com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar clã:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/{id}/ally/{allyId}:
 *   put:
 *     summary: Adicionar um clã como aliado (Líder do Clã ou ADM)
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: allyId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã aliado a ser adicionado
 *     responses:
 *       200:
 *         description: Clã aliado adicionado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Clã aliado não encontrado ou já é aliado
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para adicionar aliados a este clã
 *       500:
 *         description: Erro no servidor
 */
exports.addAlly = async (req, res) => {
  const { allyId } = req.params;
  const clan = req.clan;

  try {
    const allyClan = await Clan.findById(allyId);
    if (!allyClan) {
      return res.status(404).json({ msg: "Clã aliado não encontrado." });
    }

    if (clan.allies.includes(allyId)) {
      return res.status(400).json({ msg: "Este clã já é seu aliado." });
    }

    clan.allies.push(allyId);
    await clan.save();

    res.json({ success: true, msg: "Clã adicionado como aliado com sucesso!" });
  } catch (error) {
    console.error("Erro ao adicionar aliado:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/{id}/remove-ally/{allyId}:
 *   put:
 *     summary: Remover um clã como aliado (Líder do Clã ou ADM)
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: allyId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã aliado a ser removido
 *     responses:
 *       200:
 *         description: Clã aliado removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Clã aliado não é aliado
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para remover aliados deste clã
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.removeAlly = async (req, res) => {
  const { allyId } = req.params;
  const clan = req.clan;

  try {
    if (!clan.allies.includes(allyId)) {
      return res.status(400).json({ msg: "Este clã não é seu aliado." });
    }

    clan.allies = clan.allies.filter(ally => ally.toString() !== allyId);
    await clan.save();

    res.json({ success: true, msg: "Clã removido como aliado com sucesso!" });
  } catch (error) {
    console.error("Erro ao remover inimigo:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/{id}/enemy/{enemyId}:
 *   put:
 *     summary: Adicionar um clã como inimigo (Líder do Clã ou ADM)
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: enemyId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã inimigo a ser adicionado
 *     responses:
 *       200:
 *         description: Clã inimigo adicionado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Clã inimigo não encontrado ou já é inimigo
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para adicionar inimigos a este clã
 *       500:
 *         description: Erro no servidor
 */
exports.addEnemy = async (req, res) => {
  const { enemyId } = req.params;
  const clan = req.clan;

  try {
    const enemyClan = await Clan.findById(enemyId);
    if (!enemyClan) {
      return res.status(404).json({ msg: "Clã inimigo não encontrado." });
    }

    if (clan.enemies.includes(enemyId)) {
      return res.status(400).json({ msg: "Este clã já é seu inimigo." });
    }

    clan.enemies.push(enemyId);
    await clan.save();

    res.json({ success: true, msg: "Clã adicionado como inimigo com sucesso!" });
  } catch (error) {
    console.error("Erro ao adicionar inimigo:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/{id}/remove-enemy/{enemyId}:
 *   put:
 *     summary: Remover um clã como inimigo (Líder do Clã ou ADM)
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: enemyId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã inimigo a ser removido
 *     responses:
 *       200:
 *         description: Clã inimigo removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Clã inimigo não é inimigo
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para remover inimigos deste clã
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.removeEnemy = async (req, res) => {
  const { enemyId } = req.params;
  const clan = req.clan;

  try {
    if (!clan.enemies.includes(enemyId)) {
      return res.status(400).json({ msg: "Este clã não é seu inimigo." });
    }

    clan.enemies = clan.enemies.filter(enemy => enemy.toString() !== enemyId);
    await clan.save();

    res.json({ success: true, msg: "Clã removido como inimigo com sucesso!" });
  } catch (error) {
    console.error("Erro ao remover inimigo:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/federation/{federationId}:
 *   get:
 *     summary: Obter clãs por ID de federação
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: federationId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *     responses:
 *       200:
 *         description: Lista de clãs da federação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 clans:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/Clan"
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.getClansByFederation = async (req, res) => {
  try {
    const { federationId } = req.params;
    const clans = await Clan.find({ federation: federationId })
      .populate("leader", "username avatar")
      .populate("subLeaders", "username avatar")
      .populate("members", "username avatar")
      .populate("federation", "name")
      .lean();

    if (!clans) {
      return res.status(404).json({ msg: "Federação não encontrada" });
    }

    res.json({ success: true, clans });
  } catch (error) {
    console.error("Erro ao obter clãs por federação:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/{id}/roles:
 *   post:
 *     summary: Adicionar um cargo personalizado a um clã (Líder do Clã ou ADM)
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - permissions
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome do cargo
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Permissões associadas ao cargo
 *     responses:
 *       200:
 *         description: Cargo personalizado adicionado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 clan:
 *                   $ref: "#/components/schemas/Clan"
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para adicionar cargos neste clã
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.addCustomRole = async (req, res) => {
  const { id } = req.params;
  const { name, permissions } = req.body;
  const clan = req.clan;

  try {
    if (clan.customRoles.some(role => role.name === name)) {
      return res.status(400).json({ msg: "Cargo com este nome já existe." });
    }

    clan.customRoles.push({ name, permissions });
    await clan.save();

    res.json({ success: true, msg: "Cargo personalizado adicionado com sucesso!", clan });
  } catch (error) {
    console.error("Erro ao adicionar cargo personalizado:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/{id}/roles/{roleName}:
 *   put:
 *     summary: Atualizar um cargo personalizado em um clã (Líder do Clã ou ADM)
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: roleName
 *         schema:
 *           type: string
 *         required: true
 *         description: Nome do cargo a ser atualizado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Novas permissões associadas ao cargo
 *     responses:
 *       200:
 *         description: Cargo personalizado atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 clan:
 *                   $ref: "#/components/schemas/Clan"
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar cargos neste clã
 *       404:
 *         description: Clã ou cargo não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.updateCustomRole = async (req, res) => {
  const { id, roleName } = req.params;
  const { permissions } = req.body;
  const clan = req.clan;

  try {
    const roleIndex = clan.customRoles.findIndex(role => role.name === roleName);
    if (roleIndex === -1) {
      return res.status(404).json({ msg: "Cargo não encontrado." });
    }

    clan.customRoles[roleIndex].permissions = permissions;
    await clan.save();

    res.json({ success: true, msg: "Cargo personalizado atualizado com sucesso!", clan });
  } catch (error) {
    console.error("Erro ao atualizar cargo personalizado:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/{id}/roles/{roleName}:
 *   delete:
 *     summary: Deletar um cargo personalizado de um clã (Líder do Clã ou ADM)
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: roleName
 *         schema:
 *           type: string
 *         required: true
 *         description: Nome do cargo a ser deletado
 *     responses:
 *       200:
 *         description: Cargo personalizado deletado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 clan:
 *                   $ref: "#/components/schemas/Clan"
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para deletar cargos neste clã
 *       404:
 *         description: Clã ou cargo não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.deleteCustomRole = async (req, res) => {
  const { id, roleName } = req.params;
  const clan = req.clan;

  try {
    clan.customRoles = clan.customRoles.filter(role => role.name !== roleName);
    await clan.save();

    res.json({ success: true, msg: "Cargo personalizado deletado com sucesso!", clan });
  } catch (error) {
    console.error("Erro ao deletar cargo personalizado:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/{id}/members/{userId}/assign-role:
 *   put:
 *     summary: Atribuir um cargo personalizado a um membro (Líder do Clã ou ADM)
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do membro
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleName
 *             properties:
 *               roleName:
 *                 type: string
 *                 description: Nome do cargo a ser atribuído
 *     responses:
 *       200:
 *         description: Cargo atribuído com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 clan:
 *                   $ref: "#/components/schemas/Clan"
 *       400:
 *         description: Cargo não encontrado ou usuário já possui este cargo
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atribuir cargos neste clã
 *       404:
 *         description: Clã, membro ou cargo não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.assignMemberRole = async (req, res) => {
  const { id, userId } = req.params;
  const { roleName } = req.body;
  const clan = req.clan;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    if (!clan.members.includes(userId)) {
      return res.status(400).json({ msg: "Usuário não é membro deste clã." });
    }

    const roleExists = clan.customRoles.some(role => role.name === roleName);
    if (!roleExists) {
      return res.status(404).json({ msg: "Cargo não encontrado." });
    }

    user.clanRole = roleName;
    await user.save();

    res.json({ success: true, msg: "Cargo atribuído com sucesso!", clan });
  } catch (error) {
    console.error("Erro ao atribuir cargo a membro:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/clans/{id}/members/{userId}/remove-role:
 *   put:
 *     summary: Remover um cargo personalizado de um membro (Líder do Clã ou ADM)
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do membro
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleName
 *             properties:
 *               roleName:
 *                 type: string
 *                 description: Nome do cargo a ser removido
 *     responses:
 *       200:
 *         description: Cargo removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 clan:
 *                   $ref: "#/components/schemas/Clan"
 *       400:
 *         description: Usuário não possui este cargo
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para remover cargos deste clã
 *       404:
 *         description: Clã, membro ou cargo não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.removeMemberRole = async (req, res) => {
  const { id, userId } = req.params;
  const { roleName } = req.body;
  const clan = req.clan;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    if (!clan.members.includes(userId)) {
      return res.status(400).json({ msg: "Usuário não é membro deste clã." });
    }

    if (user.clanRole !== roleName) {
      return res.status(400).json({ msg: "Usuário não possui este cargo." });
    }

    user.clanRole = "member"; // Ou defina como um cargo padrão, se houver
    await user.save();

    res.json({ success: true, msg: "Cargo removido com sucesso!", clan });
  } catch (error) {
    console.error("Erro ao remover cargo de membro:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};


