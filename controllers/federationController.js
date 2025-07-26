const Federation = require("../models/Federation");
const Clan = require("../models/Clan");
const User = require("../models/User");
const cacheService = require("../services/cacheService");
const CacheKeys = require("../utils/cacheKeys");

/**
 * @swagger
 * /api/federations:
 *   get:
 *     summary: Obter todas as federações
 *     tags: [Federações]
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
 *     responses:
 *       200:
 *         description: Lista de todas as federações
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
 *                     $ref: '#/components/schemas/Federation'
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
exports.getFederations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const cacheKey = CacheKeys.federationList(`p${page}_l${limit}`);
    
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.json({
        ...cachedData,
        cached: true,
        cacheKey
      });
    }

    const federations = await Federation.find({})
      .populate("leader", "username avatar")
      .populate("subLeaders", "username avatar")
      .populate("clans", "name tag")
      .lean()
      .skip(skip)
      .limit(limit);

    const totalFederations = await Federation.countDocuments({});

    const responseData = {
      success: true,
      count: federations.length,
      total: totalFederations,
      page,
      pages: Math.ceil(totalFederations / limit),
      data: federations,
    };

    await cacheService.set(cacheKey, responseData, 3600);

    res.json(responseData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/federations/{id}:
 *   get:
 *     summary: Obter detalhes de uma federação por ID
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *     responses:
 *       200:
 *         description: Detalhes da federação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Federation'
 *                 cached:
 *                   type: boolean
 *                   description: Indica se a resposta veio do cache
 *                 cacheKey:
 *                   type: string
 *                   description: Chave do cache utilizada
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.getFederationById = async (req, res) => {
  try {
    const federationId = req.params.id;
    
    const cacheKey = CacheKeys.federation(federationId);
    
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.json({
        ...cachedData,
        cached: true,
        cacheKey
      });
    }

    const federation = await Federation.findById(federationId)
      .populate("leader", "username avatar")
      .populate("subLeaders", "username avatar")
      .populate("clans", "name tag leader")
      .populate("allies", "name")
      .populate("enemies", "name")
      .lean();
    
    if (!federation) {
      return res.status(404).json({ msg: "Federação não encontrada" });
    }

    const responseData = {
      success: true,
      data: federation,
    };

    await cacheService.set(cacheKey, responseData, 3600);

    res.json(responseData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/federations:
 *   post:
 *     summary: Criar uma nova federação (apenas ADM)
 *     tags: [Federações]
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
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome da federação
 *               description:
 *                 type: string
 *                 description: Descrição da federação
 *               leaderId:
 *                 type: string
 *                 description: ID do usuário que será o líder (opcional, se não especificado, o ADM será o líder)
 *     responses:
 *       201:
 *         description: Federação criada com sucesso
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
 *                   $ref: '#/components/schemas/Federation'
 *       400:
 *         description: Erro de validação
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, apenas ADMs podem criar federações
 *       500:
 *         description: Erro no servidor
 */
exports.createFederation = async (req, res) => {
  const { name, description, leaderId } = req.body;

  try {
    // Verificar se já existe uma federação com esse nome
    const existingFederation = await Federation.findOne({ name });
    if (existingFederation) {
      return res.status(400).json({ msg: "Já existe uma federação com este nome." });
    }

    // Determinar quem será o líder
    let chosenLeader = null;
    if (leaderId) {
      chosenLeader = await User.findById(leaderId);
      if (!chosenLeader) {
        return res.status(404).json({ msg: "Usuário escolhido para líder não encontrado." });
      }
    } else {
      // Se não especificou líder, o ADM será o líder
      chosenLeader = await User.findById(req.user.id);
    }

    const federation = new Federation({
      name,
      description,
      leader: chosenLeader._id,
    });

    await federation.save();

    // Atualizar o usuário escolhido como líder
    if (chosenLeader.role !== "ADM") {
      chosenLeader.federation = federation._id;
      chosenLeader.federationRole = "leader";
      await chosenLeader.save();
    }

    // Invalidar cache
    await cacheService.del(CacheKeys.federationList());

    res.status(201).json({ 
      success: true,
      msg: "Federação criada com sucesso!", 
      data: federation,
      leader: { id: chosenLeader._id, username: chosenLeader.username }
    });
  } catch (err) {
    console.error("Erro ao criar federação:", err);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

/**
 * @swagger
 * /api/federations/{id}:
 *   put:
 *     summary: Atualizar informações de uma federação
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação a ser atualizada
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Novo nome da federação
 *               description:
 *                 type: string
 *                 description: Nova descrição da federação
 *               rules:
 *                 type: string
 *                 description: Novas regras da federação
 *     responses:
 *       200:
 *         description: Federação atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Federation'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar esta federação
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.updateFederation = async (req, res) => {
  const { name, description, rules } = req.body;
  const federation = req.federation;

  try {
    if (name) {
      // Verificar se o novo nome já está em uso
      const existingFederation = await Federation.findOne({ 
        name, 
        _id: { $ne: federation._id } 
      });
      if (existingFederation) {
        return res.status(400).json({ msg: "Já existe uma federação com este nome." });
      }
      federation.name = name;
    }
    
    if (description) federation.description = description;
    if (rules) federation.rules = rules;

    await federation.save();

    // Invalidar cache
    await cacheService.del(CacheKeys.federation(federation._id));
    await cacheService.del(CacheKeys.federationList());

    res.json({ success: true, data: federation });
  } catch (err) {
    console.error("Erro ao atualizar federação:", err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/federations/{id}/add-clan/{clanId}:
 *   put:
 *     summary: Adicionar um clã a uma federação
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *       - in: path
 *         name: clanId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã a ser adicionado
 *     responses:
 *       200:
 *         description: Clã adicionado à federação com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 federation:
 *                   $ref: '#/components/schemas/Federation'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para adicionar clãs a esta federação
 *       404:
 *         description: Federação ou clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.addClanToFederation = async (req, res) => {
  try {
    const federation = req.federation;
    const clan = await Clan.findById(req.params.clanId);

    if (!clan) return res.status(404).json({ msg: "Clã não encontrado" });
    if (clan.federation) return res.status(400).json({ msg: "Este clã já pertence a uma federação." });
    if (federation.clans.includes(req.params.clanId)) return res.status(400).json({ msg: "Clã já está nesta federação." });

    federation.clans.push(req.params.clanId);
    await federation.save();

    clan.federation = federation._id;
    await clan.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.federation(federation._id));
    await cacheService.del(CacheKeys.clan(clan._id));

    res.json({ success: true, msg: "Clã adicionado à federação com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/federations/{id}/remove-clan/{clanId}:
 *   put:
 *     summary: Remover um clã de uma federação
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *       - in: path
 *         name: clanId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã a ser removido
 *     responses:
 *       200:
 *         description: Clã removido da federação com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 federation:
 *                   $ref: '#/components/schemas/Federation'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para remover clãs desta federação
 *       404:
 *         description: Federação ou clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.removeClanFromFederation = async (req, res) => {
  try {
    const federation = req.federation;
    const clan = await Clan.findById(req.params.clanId);

    if (!clan) return res.status(404).json({ msg: "Clã não encontrado" });
    if (!federation.clans.includes(req.params.clanId)) return res.status(400).json({ msg: "Clã não pertence a esta federação." });

    federation.clans = federation.clans.filter(c => c.toString() !== req.params.clanId);
    await federation.save();

    clan.federation = null;
    await clan.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.federation(federation._id));
    await cacheService.del(CacheKeys.clan(clan._id));

    res.json({ success: true, msg: "Clã removido da federação com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/federations/{id}/promote-subleader/{userId}:
 *   put:
 *     summary: Promover um usuário a sub-líder da federação
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser promovido
 *     responses:
 *       200:
 *         description: Usuário promovido a sub-líder com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 federation:
 *                   $ref: '#/components/schemas/Federation'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para promover sub-líderes nesta federação
 *       404:
 *         description: Federação ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.promoteSubLeader = async (req, res) => {
  try {
    const federation = req.federation;
    const user = await User.findById(req.params.userId);

    if (!user) return res.status(404).json({ msg: "Usuário não encontrado" });
    if (federation.subLeaders.includes(req.params.userId)) return res.status(400).json({ msg: "Usuário já é sub-líder da federação." });

    federation.subLeaders.push(req.params.userId);
    await federation.save();

    user.federationRole = "subleader";
    await user.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.federation(federation._id));
    await cacheService.del(CacheKeys.user(user._id));

    res.json({ success: true, msg: "Usuário promovido a sub-líder da federação com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/federations/{id}/demote-subleader/{userId}:
 *   put:
 *     summary: Rebaixar um sub-líder da federação
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
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
 *                 federation:
 *                   $ref: '#/components/schemas/Federation'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para rebaixar sub-líderes nesta federação
 *       404:
 *         description: Federação ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.demoteSubLeader = async (req, res) => {
  try {
    const federation = req.federation;
    const user = await User.findById(req.params.userId);

    if (!user) return res.status(404).json({ msg: "Usuário não encontrado" });
    if (!federation.subLeaders.includes(req.params.userId)) return res.status(400).json({ msg: "Usuário não é sub-líder da federação." });

    federation.subLeaders = federation.subLeaders.filter(sl => sl.toString() !== req.params.userId);
    await federation.save();

    user.federationRole = "member";
    await user.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.federation(federation._id));
    await cacheService.del(CacheKeys.user(user._id));

    res.json({ success: true, msg: "Usuário rebaixado com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * Transferir liderança de uma federação
 */
exports.transferLeadership = async (req, res) => {
  try {
    const { newLeaderId } = req.body;
    const federation = req.federation;

    if (!newLeaderId) {
      return res.status(400).json({ 
        success: false, 
        message: "ID do novo líder é obrigatório" 
      });
    }

    const newLeader = await User.findById(newLeaderId);
    if (!newLeader) {
      return res.status(404).json({ 
        success: false, 
        message: "Novo líder não encontrado" 
      });
    }

    // Verificar se o novo líder é membro da federação ou é ADM
    const isMemberOfFederation = federation.subLeaders.includes(newLeaderId) || 
                                 federation.leader.toString() === newLeaderId;
    const isAdmin = newLeader.role === "ADM";

    if (!isMemberOfFederation && !isAdmin) {
      return res.status(400).json({ 
        success: false, 
        message: "O novo líder deve ser membro da federação ou ADM" 
      });
    }

    // Atualizar o líder anterior (remover role de líder se não for ADM)
    const oldLeader = await User.findById(federation.leader);
    if (oldLeader && oldLeader.role !== "ADM") {
      oldLeader.federationRole = "member";
      await oldLeader.save();
    }

    // Atualizar o novo líder (dar role de líder se não for ADM)
    if (newLeader.role !== "ADM") {
      newLeader.federationRole = "leader";
      newLeader.federation = federation._id;
      await newLeader.save();
    }

    // Atualizar a federação
    federation.leader = newLeaderId;
    await federation.save();

    // Invalidar cache
    await cacheService.del(CacheKeys.federation(federation._id));
    await cacheService.del(CacheKeys.federationList());

    const populatedFederation = await Federation.findById(federation._id)
      .populate("leader", "username")
      .populate("clans", "name tag");

    res.json({ 
      success: true, 
      message: "Liderança transferida com sucesso",
      federation: populatedFederation 
    });
  } catch (err) {
    console.error("Erro ao transferir liderança da federação:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erro interno do servidor" 
    });
  }
};

/**
 * @swagger
 * /api/federations/{federationId}/allocate-territory/{clanId}:
 *   post:
 *     summary: Alocar território para um clã dentro de uma federação
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: federationId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *       - in: path
 *         name: clanId
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
 *               - mapX
 *               - mapY
 *               - radius
 *             properties:
 *               mapX:
 *                 type: number
 *                 description: Coordenada X do território no mapa
 *               mapY:
 *                 type: number
 *                 description: Coordenada Y do território no mapa
 *               radius:
 *                 type: number
 *                 description: Raio do território
 *               color:
 *                 type: string
 *                 description: Cor do território em hexadecimal
 *     responses:
 *       200:
 *         description: Território alocado com sucesso
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
 *                   $ref: '#/components/schemas/Clan'
 *       400:
 *         description: Erro de validação
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão
 *       404:
 *         description: Federação ou clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.allocateClanTerritory = async (req, res) => {
  try {
    const { federationId, clanId } = req.params;
    const { mapX, mapY, radius, color } = req.body;

    const federation = await Federation.findById(federationId);
    if (!federation) {
      return res.status(404).json({ success: false, message: "Federação não encontrada" });
    }

    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({ success: false, message: "Clã não encontrado" });
    }

    // Verificar se o clã pertence à federação
    if (!federation.clans.includes(clanId)) {
      return res.status(400).json({ success: false, message: "Clã não pertence a esta federação" });
    }

    // Atualizar território do clã
    clan.territory = {
      mapX: mapX,
      mapY: mapY,
      radius: radius,
      color: color || "#FF0000"
    };

    await clan.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clanId));
    await cacheService.del(CacheKeys.federation(federationId));

    res.json({
      success: true,
      message: "Território do clã alocado com sucesso",
      clan: clan
    });

  } catch (err) {
    console.error("Erro ao alocar território do clã:", err);
    res.status(500).json({ success: false, message: "Erro interno do servidor" });
  }
};

/**
 * @swagger
 * /api/federations/{id}/banner:
 *   put:
 *     summary: Atualizar o banner de uma federação
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
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
 *         description: Proibido, usuário não tem permissão para atualizar esta federação
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.updateFederationBanner = async (req, res) => {
  try {
    const federation = req.federation;

    if (!req.file) {
      return res.status(400).json({ msg: "Nenhum arquivo foi enviado." });
    }

    const bannerUrl = `/uploads/federation_banners/${req.file.filename}`;
    federation.banner = bannerUrl;
    await federation.save();

    // Invalidar cache
    await cacheService.del(CacheKeys.federation(federation._id));

    res.json({
      success: true,
      msg: "Banner da federação atualizado com sucesso!",
      bannerUrl: bannerUrl,
    });
  } catch (err) {
    console.error("Erro ao atualizar banner da federação:", err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/federations/{id}:
 *   delete:
 *     summary: Deletar uma federação (apenas ADM)
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação a ser deletada
 *     responses:
 *       200:
 *         description: Federação deletada com sucesso
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
 *         description: Proibido, apenas ADMs podem deletar federações
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.deleteFederation = async (req, res) => {
  try {
    const federation = await Federation.findById(req.params.id);

    if (!federation) {
      return res.status(404).json({ msg: "Federação não encontrada" });
    }

    // Remover referências da federação de todos os usuários
    await User.updateMany(
      { federation: federation._id },
      { $unset: { federation: "", federationRole: "" } }
    );

    // Remover referências da federação de todos os clãs
    await Clan.updateMany(
      { federation: federation._id },
      { $unset: { federation: "" } }
    );

    // Deletar a federação
    await Federation.deleteOne({ _id: federation._id });

    // Invalidar caches
    await cacheService.del(CacheKeys.federation(federation._id));
    await cacheService.del(CacheKeys.federationList());

    res.json({ success: true, msg: "Federação deletada com sucesso!" });
  } catch (err) {
    console.error("Erro ao deletar federação:", err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/federations/{id}/leave:
 *   post:
 *     summary: Sair de uma federação
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *     responses:
 *       200:
 *         description: Usuário saiu da federação com sucesso
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
 *         description: Usuário não pertence à federação ou é o líder
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.leaveFederation = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const federation = await Federation.findById(req.params.id);

    if (!federation) {
      return res.status(404).json({ msg: "Federação não encontrada" });
    }

    if (!user.federation || user.federation.toString() !== federation._id.toString()) {
      return res.status(400).json({ msg: "Você não pertence a esta federação." });
    }

    // Verificar se é o líder
    if (federation.leader && federation.leader.toString() === user._id.toString()) {
      return res.status(400).json({ 
        msg: "Você é o líder da federação. Transfira a liderança antes de sair." 
      });
    }

    // Remover usuário da federação (se ele for um sub-líder)
    federation.subLeaders = federation.subLeaders.filter(sl => sl.toString() !== user._id.toString());
    await federation.save();

    // Limpar dados do usuário
    user.federation = null;
    user.federationRole = null;
    await user.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.federation(federation._id));
    await cacheService.del(CacheKeys.user(user._id));

    res.json({ success: true, msg: "Você saiu da federação com sucesso!" });
  } catch (err) {
    console.error("Erro ao sair da federação:", err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/federations/{id}/add-ally/{allyId}:
 *   put:
 *     summary: Adicionar uma federação aliada
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *       - in: path
 *         name: allyId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação aliada a ser adicionada
 *     responses:
 *       200:
 *         description: Federação aliada adicionada com sucesso
 *       400:
 *         description: "Requisição inválida (ex: já é aliada)"
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão
 *       404:
 *         description: Federação ou federação aliada não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.addAlly = async (req, res) => {
  try {
    const federation = req.federation;
    const { allyId } = req.params;

    // Verifica se a federação aliada existe
    const allyFederation = await Federation.findById(allyId);
    if (!allyFederation) {
      return res.status(404).json({ msg: "Federação aliada não encontrada." });
    }

    // Verifica se já são aliados
    if (federation.allies.includes(allyId)) {
      return res.status(400).json({ msg: "Esta federação já é uma aliada." });
    }

    federation.allies.push(allyId);
    await federation.save();

    // Invalidar caches relevantes
    await cacheService.del(CacheKeys.federation(federation._id));
    await cacheService.del(CacheKeys.federation(allyId));

    res.json({ success: true, msg: "Federação aliada adicionada com sucesso!" });
  } catch (err) {
    console.error("Erro ao adicionar federação aliada:", err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/federations/{id}/remove-ally/{allyId}:
 *   put:
 *     summary: Remover uma federação aliada
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
 *       - in: path
 *         name: allyId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação aliada a ser removida
 *     responses:
 *       200:
 *         description: Federação aliada removida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 federation:
 *                   $ref: '#/components/schemas/Federation'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para remover aliados desta federação
 *       404:
 *         description: Federação ou federação aliada não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.removeAlly = async (req, res) => {
  try {
    const federation = req.federation;
    const allyId = req.params.allyId;

    if (!federation.allies.includes(allyId)) {
      return res.status(400).json({ msg: "Esta federação não é aliada." });
    }

    federation.allies = federation.allies.filter(ally => ally.toString() !== allyId);
    await federation.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.federation(federation._id));
    await cacheService.del(CacheKeys.federation(allyId)); // Invalida o cache da federação aliada também

    res.json({ success: true, msg: "Federação aliada removida com sucesso!" });
  } catch (err) {
    console.error("Erro ao remover federação aliada:", err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

