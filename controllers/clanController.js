const { validationResult } = require('express-validator');
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

    // Filtrar membros para não incluir líderes e sub-líderes
    clans.forEach(clan => {
      const leaderId = clan.leader ? clan.leader._id.toString() : null;
      const subLeaderIds = clan.subLeaders.map(sl => sl._id.toString());
      clan.members = clan.members.filter(member => 
        member._id.toString() !== leaderId && 
        !subLeaderIds.includes(member._id.toString())
      );
    });

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

    // Filtrar membros para não incluir líderes e sub-líderes
    const leaderId = clan.leader ? clan.leader._id.toString() : null;
    const subLeaderIds = clan.subLeaders.map(sl => sl._id.toString());
    clan.members = clan.members.filter(member => 
      member._id.toString() !== leaderId && 
      !subLeaderIds.includes(member._id.toString())
    );

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
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, tag, description, leaderId } = req.body;

  try {
    const user = await User.findById(req.user.id);
    
    // Se o usuário já pertence a um clã e NÃO é ADM, impede a criação
    if (user.clan && user.role !== "ADM") {
      return res.status(400).json({ msg: "Você já pertence a um clã." });
    }

    let clan = await Clan.findOne({ tag: tag.toUpperCase() });
    if (clan) {
      return res.status(400).json({ msg: "Esta tag já está em uso." });
    }

    let chosenLeader = user; // Por padrão, o criador é o líder
    let initialMembers = [user._id];

    // Se o usuário é ADM e um leaderId foi fornecido, tenta usar esse líder
    if (user.role === "ADM" && leaderId) {
      chosenLeader = await User.findById(leaderId);
      if (!chosenLeader) {
        return res.status(404).json({ msg: "Usuário escolhido para líder não encontrado." });
      }
      // Se o líder escolhido já pertence a um clã, impede a criação
      if (chosenLeader.clan) {
        return res.status(400).json({ msg: "O usuário escolhido para líder já pertence a um clã." });
      }
      initialMembers = [chosenLeader._id];
    } else if (user.role === "ADM" && !leaderId) {
      // Se ADM não especificou líder, o clã é criado sem líder e sem membros iniciais
      chosenLeader = null;
      initialMembers = [];
    } else if (user.clan) {
      // Se usuário normal já pertence a um clã, impede a criação
      return res.status(400).json({ msg: "Você já pertence a um clã." });
    }

    clan = new Clan({
      name,
      tag: tag.toUpperCase(),
      description,
      leader: chosenLeader ? chosenLeader._id : null,
      members: initialMembers,
    });

    await clan.save();

    // Atualizar o usuário escolhido como líder (se houver)
    if (chosenLeader) {
      chosenLeader.clan = clan._id;
      chosenLeader.clanRole = "Leader";
      await chosenLeader.save();
    }

    // Se o usuário criador não é o líder escolhido (caso de ADM criando para outro), atualiza o criador
    if (user._id.toString() !== (chosenLeader ? chosenLeader._id.toString() : '')) {
      user.clan = clan._id;
      user.clanRole = "Member"; // O criador ADM entra como membro se não for o líder
      await user.save();
    }

    // Invalidar caches
    await cacheService.del(CacheKeys.clanList('all'));
    await cacheService.del(CacheKeys.clanList('all_p1_l10'));

    res.status(201).json({
      msg: "Clã criado com sucesso!",
      data: clan,
      leader: chosenLeader ? { id: chosenLeader._id, username: chosenLeader.username } : null
    });
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
    
    // Invalidar cache do clã específico
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.clanList('all'));
    
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
 *                 description: Arquivo de imagem para o banner
 *     responses:
 *       200:
 *         description: Banner atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 bannerUrl:
 *                   type: string
 *                   description: URL do novo banner
 *       400:
 *         description: Arquivo não fornecido ou formato inválido
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar este clã
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.updateClanBanner = async (req, res) => {
  try {
    const clan = req.clan;

    if (!req.file) {
      return res.status(400).json({ msg: "Nenhum arquivo foi enviado." });
    }

    const bannerUrl = `/uploads/clan_banners/${req.file.filename}`;
    clan.banner = bannerUrl;
    await clan.save();

    // Invalidar cache do clã
    await cacheService.del(CacheKeys.clan(clan._id));

    res.json({
      success: true,
      msg: "Banner do clã atualizado com sucesso!",
      bannerUrl: bannerUrl,
    });
  } catch (error) {
    console.error("Erro ao atualizar banner do clã:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/join:
 *   post:
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
 *         description: Usuário entrou no clã com sucesso
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
 *         description: Usuário já pertence a um clã ou clã está cheio
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.joinClan = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const clan = await Clan.findById(req.params.id);

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    if (user.clan && user.role !== "ADM") {
      return res.status(400).json({ msg: "Você já pertence a um clã." });
    }

    if (clan.members.length >= 50) {
      return res.status(400).json({ msg: "Este clã já atingiu o limite máximo de membros." });
    }

    // Se o usuário já é membro do clã (mesmo que ADM), não faz nada
    if (clan.members.includes(user._id)) {
      return res.status(200).json({ success: true, msg: "Você já é membro deste clã." });
    }

    clan.members.push(user._id);
    await clan.save();

    user.clan = clan._id;
    user.clanRole = "Member"; // ADM que entra como membro, pode ser promovido depois
    await user.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.user(user._id));

    res.json({ success: true, msg: "Você entrou no clã com sucesso!" });
  } catch (error) {
    console.error("Erro ao entrar no clã:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/leave:
 *   post:
 *     summary: Sair do clã atual
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuário saiu do clã com sucesso
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
 *         description: Usuário não pertence a nenhum clã ou é o líder
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro no servidor
 */
exports.leaveClan = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user.clan) {
      return res.status(400).json({ msg: "Você não pertence a nenhum clã." });
    }

    const clan = await Clan.findById(user.clan);
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado." });
    }

    // Verificar se é o líder
    if (clan.leader && clan.leader.toString() === user._id.toString()) {
      return res.status(400).json({ 
        msg: "Você é o líder do clã. Transfira a liderança antes de sair ou use a função de purga se for ADM." 
      });
    }

    // Remover usuário do clã
    clan.members = clan.members.filter(member => member.toString() !== user._id.toString());
    clan.subLeaders = clan.subLeaders.filter(subLeader => subLeader.toString() !== user._id.toString());
    await clan.save();

    // Limpar dados do usuário
    user.clan = null;
    user.clanRole = null;
    await user.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.user(user._id));

    res.json({ success: true, msg: "Você saiu do clã com sucesso!" });
  } catch (error) {
    console.error("Erro ao sair do clã:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/transfer/{userId}:
 *   put:
 *     summary: Transferir liderança do clã
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
 *         description: ID do usuário que se tornará o novo líder
 *     responses:
 *       200:
 *         description: Liderança transferida com sucesso
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
 *         description: Usuário não é membro do clã
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, apenas o líder pode transferir liderança
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.transferLeadership = async (req, res) => {
  try {
    const clan = req.clan;
    const newLeader = await User.findById(req.params.userId);

    if (!newLeader) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    if (!clan.members.includes(req.params.userId)) {
      return res.status(400).json({ msg: "O usuário deve ser membro do clã para se tornar líder." });
    }

    // Atualizar líder anterior
    const oldLeader = await User.findById(clan.leader);
    if (oldLeader) {
      oldLeader.clanRole = "Member";
      await oldLeader.save();
    }

    // Atualizar novo líder
    newLeader.clanRole = "Leader";
    await newLeader.save();

    // Atualizar clã
    clan.leader = req.params.userId;
    // Remover novo líder da lista de sublíderes se estiver lá
    clan.subLeaders = clan.subLeaders.filter(sl => sl.toString() !== req.params.userId);
    await clan.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.user(oldLeader._id));
    await cacheService.del(CacheKeys.user(newLeader._id));

    res.json({ success: true, msg: "Liderança transferida com sucesso!" });
  } catch (error) {
    console.error("Erro ao transferir liderança:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/promote/{userId}:
 *   put:
 *     summary: Promover um membro a sub-líder
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
 *         description: Usuário promovido com sucesso
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
 *         description: Usuário não é membro do clã ou já é sub-líder
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, apenas o líder pode promover membros
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.promoteMember = async (req, res) => {
  try {
    const clan = req.clan;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    if (!clan.members.includes(req.params.userId)) {
      return res.status(400).json({ msg: "Usuário não é membro do clã." });
    }

    if (clan.subLeaders.includes(req.params.userId)) {
      return res.status(400).json({ msg: "Usuário já é sub-líder do clã." });
    }

    clan.subLeaders.push(req.params.userId);
    await clan.save();

    user.clanRole = "SubLeader";
    await user.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.user(user._id));

    res.json({ success: true, msg: "Usuário promovido a sub-líder com sucesso!" });
  } catch (error) {
    console.error("Erro ao promover usuário:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/demote/{userId}:
 *   put:
 *     summary: Rebaixar um sub-líder a membro
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
 *         description: Usuário rebaixado com sucesso
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
 *         description: Usuário não é sub-líder do clã
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, apenas o líder pode rebaixar sub-líderes
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.demoteMember = async (req, res) => {
  try {
    const clan = req.clan;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    if (!clan.subLeaders.includes(req.params.userId)) {
      return res.status(400).json({ msg: "Usuário não é sub-líder do clã." });
    }

    clan.subLeaders = clan.subLeaders.filter(sl => sl.toString() !== req.params.userId);
    await clan.save();

    user.clanRole = "Member";
    await user.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.user(user._id));

    res.json({ success: true, msg: "Usuário rebaixado a membro com sucesso!" });
  } catch (error) {
    console.error("Erro ao rebaixar usuário:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/kick/{userId}:
 *   delete:
 *     summary: Expulsar um membro do clã
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
 *         description: Usuário expulso com sucesso
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
 *         description: Usuário não é membro do clã ou é o líder
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, apenas líder ou sub-líderes podem expulsar membros
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.kickMember = async (req, res) => {
  try {
    const clan = req.clan;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    if (!clan.members.includes(req.params.userId)) {
      return res.status(400).json({ msg: "Usuário não é membro do clã." });
    }

    if (clan.leader && clan.leader.toString() === req.params.userId) {
      return res.status(400).json({ msg: "Não é possível expulsar o líder do clã." });
    }

    // Remover usuário do clã
    clan.members = clan.members.filter(member => member.toString() !== req.params.userId);
    clan.subLeaders = clan.subLeaders.filter(subLeader => subLeader.toString() !== req.params.userId);
    await clan.save();

    // Limpar dados do usuário
    user.clan = null;
    user.clanRole = null;
    await user.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.user(user._id));

    res.json({ success: true, msg: "Usuário expulso do clã com sucesso!" });
  } catch (error) {
    console.error("Erro ao expulsar usuário:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}:
 *   delete:
 *     summary: Deletar um clã (apenas ADM)
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
 *         description: Proibido, apenas ADMs podem deletar clãs
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.deleteClan = async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.id);

    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // Remover referências do clã de todos os usuários
    await User.updateMany(
      { clan: clan._id },
      { $unset: { clan: "", clanRole: "" } }
    );

    // Remover clã de federações
    await Federation.updateMany(
      { clans: clan._id },
      { $pull: { clans: clan._id } }
    );

    // Deletar o clã
    await Clan.deleteOne({ _id: clan._id });

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.clanList('all'));

    res.json({ success: true, msg: "Clã deletado com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar clã:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};



/**
 * @swagger
 * /api/clans/{id}/promote/{userId}:
 *   put:
 *     summary: Promover um membro a sub-líder
 *     tags: [Clãs]
 */
exports.promoteMember = async (req, res) => {
  try {
    const clan = req.clan;
    const { userId } = req.params;

    const member = await User.findById(userId);
    if (!member) {
      return res.status(404).json({ msg: "Membro não encontrado." });
    }

    if (!clan.members.includes(userId)) {
      return res.status(400).json({ msg: "Este usuário não é membro do clã." });
    }

    if (clan.subLeaders.includes(userId)) {
      return res.status(400).json({ msg: "Este usuário já é sub-líder." });
    }

    clan.subLeaders.push(userId);
    await clan.save();

    member.clanRole = "SubLeader";
    await member.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.user(userId));

    res.json({ success: true, msg: "Membro promovido a sub-líder com sucesso!" });
  } catch (error) {
    console.error("Erro ao promover membro:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/demote/{userId}:
 *   put:
 *     summary: Rebaixar um sub-líder a membro
 *     tags: [Clãs]
 */
exports.demoteMember = async (req, res) => {
  try {
    const clan = req.clan;
    const { userId } = req.params;

    const member = await User.findById(userId);
    if (!member) {
      return res.status(404).json({ msg: "Membro não encontrado." });
    }

    if (!clan.subLeaders.includes(userId)) {
      return res.status(400).json({ msg: "Este usuário não é sub-líder." });
    }

    clan.subLeaders = clan.subLeaders.filter(id => id.toString() !== userId);
    await clan.save();

    member.clanRole = "Member";
    await member.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.user(userId));

    res.json({ success: true, msg: "Sub-líder rebaixado a membro com sucesso!" });
  } catch (error) {
    console.error("Erro ao rebaixar membro:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/transfer/{userId}:
 *   put:
 *     summary: Transferir liderança do clã
 *     tags: [Clãs]
 */
exports.transferLeadership = async (req, res) => {
  try {
    const clan = req.clan;
    const { userId } = req.params;

    const newLeader = await User.findById(userId);
    if (!newLeader) {
      return res.status(404).json({ msg: "Usuário não encontrado." });
    }

    if (!clan.members.includes(userId)) {
      return res.status(400).json({ msg: "Este usuário não é membro do clã." });
    }

    if (clan.leader.toString() === userId) {
      return res.status(400).json({ msg: "Este usuário já é o líder do clã." });
    }

    // Atualizar o líder anterior
    const oldLeader = await User.findById(clan.leader);
    if (oldLeader) {
      oldLeader.clanRole = "Member";
      await oldLeader.save();
    }

    // Remover novo líder dos sub-líderes se estiver lá
    clan.subLeaders = clan.subLeaders.filter(id => id.toString() !== userId);
    
    // Definir novo líder
    clan.leader = userId;
    await clan.save();

    newLeader.clanRole = "Leader";
    await newLeader.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.user(userId));
    if (oldLeader) {
      await cacheService.del(CacheKeys.user(oldLeader._id));
    }

    res.json({ success: true, msg: "Liderança transferida com sucesso!" });
  } catch (error) {
    console.error("Erro ao transferir liderança:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/kick/{userId}:
 *   put:
 *     summary: Expulsar um membro do clã
 *     tags: [Clãs]
 */
exports.kickMember = async (req, res) => {
  try {
    const clan = req.clan;
    const { userId } = req.params;

    const member = await User.findById(userId);
    if (!member) {
      return res.status(404).json({ msg: "Membro não encontrado." });
    }

    if (!clan.members.includes(userId)) {
      return res.status(400).json({ msg: "Este usuário não é membro do clã." });
    }

    if (clan.leader.toString() === userId) {
      return res.status(400).json({ msg: "Não é possível expulsar o líder do clã." });
    }

    // Remover de membros e sub-líderes
    clan.members = clan.members.filter(id => id.toString() !== userId);
    clan.subLeaders = clan.subLeaders.filter(id => id.toString() !== userId);
    await clan.save();

    // Atualizar usuário
    member.clan = undefined;
    member.clanRole = undefined;
    await member.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.user(userId));

    res.json({ success: true, msg: "Membro expulso do clã com sucesso!" });
  } catch (error) {
    console.error("Erro ao expulsar membro:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/ally/{allyId}:
 *   put:
 *     summary: Adicionar um clã como aliado
 *     tags: [Clãs]
 */
exports.addAlly = async (req, res) => {
  try {
    const clan = req.clan;
    const { allyId } = req.params;

    const allyClan = await Clan.findById(allyId);
    if (!allyClan) {
      return res.status(404).json({ msg: "Clã aliado não encontrado." });
    }

    if (clan._id.toString() === allyId) {
      return res.status(400).json({ msg: "Um clã não pode ser aliado de si mesmo." });
    }

    if (clan.allies.includes(allyId)) {
      return res.status(400).json({ msg: "Este clã já é um aliado." });
    }

    clan.allies.push(allyId);
    await clan.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.clan(allyId));

    res.json({ success: true, msg: "Clã aliado adicionado com sucesso!" });
  } catch (error) {
    console.error("Erro ao adicionar aliado:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/remove-ally/{allyId}:
 *   put:
 *     summary: Remover um clã como aliado
 *     tags: [Clãs]
 */
exports.removeAlly = async (req, res) => {
  try {
    const clan = req.clan;
    const { allyId } = req.params;

    if (!clan.allies.includes(allyId)) {
      return res.status(400).json({ msg: "Este clã não é um aliado." });
    }

    clan.allies = clan.allies.filter(id => id.toString() !== allyId);
    await clan.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.clan(allyId));

    res.json({ success: true, msg: "Clã aliado removido com sucesso!" });
  } catch (error) {
    console.error("Erro ao remover aliado:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/enemy/{enemyId}:
 *   put:
 *     summary: Adicionar um clã como inimigo
 *     tags: [Clãs]
 */
exports.addEnemy = async (req, res) => {
  try {
    const clan = req.clan;
    const { enemyId } = req.params;

    const enemyClan = await Clan.findById(enemyId);
    if (!enemyClan) {
      return res.status(404).json({ msg: "Clã inimigo não encontrado." });
    }

    if (clan._id.toString() === enemyId) {
      return res.status(400).json({ msg: "Um clã não pode ser inimigo de si mesmo." });
    }

    if (clan.enemies.includes(enemyId)) {
      return res.status(400).json({ msg: "Este clã já é um inimigo." });
    }

    clan.enemies.push(enemyId);
    await clan.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.clan(enemyId));

    res.json({ success: true, msg: "Clã inimigo adicionado com sucesso!" });
  } catch (error) {
    console.error("Erro ao adicionar inimigo:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/remove-enemy/{enemyId}:
 *   put:
 *     summary: Remover um clã como inimigo
 *     tags: [Clãs]
 */
exports.removeEnemy = async (req, res) => {
  try {
    const clan = req.clan;
    const { enemyId } = req.params;

    if (!clan.enemies.includes(enemyId)) {
      return res.status(400).json({ msg: "Este clã não é um inimigo." });
    }

    clan.enemies = clan.enemies.filter(id => id.toString() !== enemyId);
    await clan.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.clan(enemyId));

    res.json({ success: true, msg: "Clã inimigo removido com sucesso!" });
  } catch (error) {
    console.error("Erro ao remover inimigo:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/federation/{federationId}:
 *   get:
 *     summary: Obter clãs por federação
 *     tags: [Clãs]
 */
exports.getClansByFederation = async (req, res) => {
  try {
    const { federationId } = req.params;

    const clans = await Clan.find({ federation: federationId })
      .populate("leader", "username avatar")
      .populate("subLeaders", "username avatar")
      .populate("members", "username avatar")
      .lean();

    res.json({ success: true, clans });
  } catch (error) {
    console.error("Erro ao obter clãs por federação:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/roles:
 *   post:
 *     summary: Adicionar cargo personalizado
 *     tags: [Clãs]
 */
exports.addCustomRole = async (req, res) => {
  try {
    const clan = req.clan;
    const { name, permissions } = req.body;

    if (!name || !permissions) {
      return res.status(400).json({ msg: "Nome e permissões são obrigatórios." });
    }

    // Verificar se o cargo já existe
    const existingRole = clan.customRoles.find(role => role.name === name);
    if (existingRole) {
      return res.status(400).json({ msg: "Este cargo já existe." });
    }

    clan.customRoles.push({ name, permissions });
    await clan.save();

    // Invalidar cache
    await cacheService.del(CacheKeys.clan(clan._id));

    res.json({ success: true, msg: "Cargo personalizado adicionado com sucesso!" });
  } catch (error) {
    console.error("Erro ao adicionar cargo personalizado:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/roles/{roleName}:
 *   put:
 *     summary: Atualizar cargo personalizado
 *     tags: [Clãs]
 */
exports.updateCustomRole = async (req, res) => {
  try {
    const clan = req.clan;
    const { roleName } = req.params;
    const { permissions } = req.body;

    const roleIndex = clan.customRoles.findIndex(role => role.name === roleName);
    if (roleIndex === -1) {
      return res.status(404).json({ msg: "Cargo não encontrado." });
    }

    clan.customRoles[roleIndex].permissions = permissions;
    await clan.save();

    // Invalidar cache
    await cacheService.del(CacheKeys.clan(clan._id));

    res.json({ success: true, msg: "Cargo personalizado atualizado com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar cargo personalizado:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/roles/{roleName}:
 *   delete:
 *     summary: Deletar cargo personalizado
 *     tags: [Clãs]
 */
exports.deleteCustomRole = async (req, res) => {
  try {
    const clan = req.clan;
    const { roleName } = req.params;

    const roleIndex = clan.customRoles.findIndex(role => role.name === roleName);
    if (roleIndex === -1) {
      return res.status(404).json({ msg: "Cargo não encontrado." });
    }

    clan.customRoles.splice(roleIndex, 1);
    await clan.save();

    // Remover o cargo de todos os usuários que o possuem
    await User.updateMany(
      { customClanRoles: roleName },
      { $pull: { customClanRoles: roleName } }
    );

    // Invalidar cache
    await cacheService.del(CacheKeys.clan(clan._id));

    res.json({ success: true, msg: "Cargo personalizado deletado com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar cargo personalizado:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/clans/{id}/members/{userId}/assign-role:
 *   put:
 *     summary: Atribuir cargo personalizado a um membro
 *     tags: [Clãs]
 */
exports.assignMemberRole = async (req, res) => {
  try {
    const clan = req.clan;
    const { userId } = req.params;
    const { roleName } = req.body;

    const member = await User.findById(userId);
    if (!member) {
      return res.status(404).json({ msg: "Membro não encontrado." });
    }

    if (!clan.members.includes(userId)) {
      return res.status(400).json({ msg: "Este usuário não é membro do clã." });
    }

    // Verificar se o cargo existe
    const roleExists = clan.customRoles.find(role => role.name === roleName);
    if (!roleExists) {
      return res.status(404).json({ msg: "Cargo não encontrado." });
    }

    // Verificar se o membro já tem o cargo
    if (member.customClanRoles && member.customClanRoles.includes(roleName)) {
      return res.status(400).json({ msg: "Membro já possui este cargo." });
    }

    // Adicionar o cargo
    if (!member.customClanRoles) {
      member.customClanRoles = [];
    }
    member.customClanRoles.push(roleName);
    await member.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.user(userId));

    res.json({ success: true, msg: `Cargo '${roleName}' atribuído ao membro com sucesso.` });
  } catch (error) {
    console.error("Erro ao atribuir cargo ao membro:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// Exportar todas as funções
module.exports = {
  getClans: exports.getClans,
  getClanById: exports.getClanById,
  createClan: exports.createClan,
  updateClan: exports.updateClan,
  updateClanBanner: exports.updateClanBanner,
  joinClan: exports.joinClan,
  leaveClan: exports.leaveClan,
  promoteMember: exports.promoteMember,
  demoteMember: exports.demoteMember,
  transferLeadership: exports.transferLeadership,
  kickMember: exports.kickMember,
  addAlly: exports.addAlly,
  removeAlly: exports.removeAlly,
  addEnemy: exports.addEnemy,
  removeEnemy: exports.removeEnemy,
  getClansByFederation: exports.getClansByFederation,
  addCustomRole: exports.addCustomRole,
  updateCustomRole: exports.updateCustomRole,
  deleteCustomRole: exports.deleteCustomRole,
  assignMemberRole: exports.assignMemberRole,
  deleteClan: exports.deleteClan
};

