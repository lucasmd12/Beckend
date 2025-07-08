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
 *                 nullable: true
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
 *                 data:
 *                   $ref: '#/components/schemas/Federation'
 *       400:
 *         description: Erro de validação ou federação já existe
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado, permissão de ADM necessária
 *       500:
 *         description: Erro no servidor
 */
exports.createFederation = async (req, res) => {
  try {
    const { name, description } = req.body;
    const newFederation = new Federation({
      name,
      description,
      leader: req.user.id,
    });
    const federation = await newFederation.save();
    res.status(201).json({ success: true, data: federation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/federations/{id}:
 *   put:
 *     summary: Atualizar detalhes de uma federação (líder ou ADM)
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
  try {
    const federation = req.federation;
    const { name, description, rules } = req.body;

    if (name) federation.name = name;
    if (description) federation.description = description;
    if (rules) federation.rules = rules;

    await federation.save();
    res.json({ success: true, data: federation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
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
 *                 description: Arquivo de imagem para o banner (max 5MB)
 *     responses:
 *       200:
 *         description: Banner da federação atualizado com sucesso
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
 *         description: "Requisição inválida (ex: nenhum arquivo, arquivo não é imagem, tamanho excedido)"
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar o banner desta federação
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.updateFederationBanner = async (req, res) => {
  try {
    const federation = req.federation;
    if (!req.file) return res.status(400).json({ msg: "Nenhum arquivo enviado" });

    federation.banner = req.file.path;
    await federation.save();
    res.json({ success: true, banner: federation.banner });
  } catch (err) {
    console.error(err);
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
 *         description: Usuário rebaixado de sub-líder com sucesso
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

    res.json({ success: true, msg: "Usuário rebaixado de sub-líder da federação com sucesso!" });
  } catch (err) {
    console.error(err);
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
 *         description: Proibido, usuário não tem permissão para adicionar aliados a esta federação
 *       404:
 *         description: Federação ou federação aliada não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.addAlly = async (req, res) => {
  try {
    const federation = req.federation;
    const allyFederation = await Federation.findById(req.params.allyId);

    if (!allyFederation) return res.status(404).json({ msg: "Federação aliada não encontrada" });
    if (federation.allies.includes(req.params.allyId)) return res.status(400).json({ msg: "Esta federação já é sua aliada." });

    federation.allies.push(req.params.allyId);
    await federation.save();

    res.json({ success: true, msg: "Federação adicionada como aliada com sucesso!" });
  } catch (err) {
    console.error(err);
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

    if (!federation.allies.includes(req.params.allyId)) return res.status(400).json({ msg: "Esta federação não é sua aliada." });

    federation.allies = federation.allies.filter(a => a.toString() !== req.params.allyId);
    await federation.save();

    res.json({ success: true, msg: "Federação removida como aliada com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/federations/{id}/add-enemy/{enemyId}:
 *   put:
 *     summary: Adicionar uma federação inimiga
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
 *         name: enemyId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação inimiga a ser adicionada
 *     responses:
 *       200:
 *         description: Federação inimiga adicionada com sucesso
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
 *         description: Proibido, usuário não tem permissão para adicionar inimigos a esta federação
 *       404:
 *         description: Federação ou federação inimiga não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.addEnemy = async (req, res) => {
  try {
    const federation = req.federation;
    const enemyFederation = await Federation.findById(req.params.enemyId);

    if (!enemyFederation) return res.status(404).json({ msg: "Federação inimiga não encontrada" });
    if (federation.enemies.includes(req.params.enemyId)) return res.status(400).json({ msg: "Esta federação já é sua inimiga." });

    federation.enemies.push(req.params.enemyId);
    await federation.save();

    res.json({ success: true, msg: "Federação adicionada como inimiga com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/federations/{id}/remove-enemy/{enemyId}:
 *   put:
 *     summary: Remover uma federação inimiga
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
 *         name: enemyId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação inimiga a ser removida
 *     responses:
 *       200:
 *         description: Federação inimiga removida com sucesso
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
 *         description: Proibido, usuário não tem permissão para remover inimigos desta federação
 *       404:
 *         description: Federação ou federação inimiga não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.removeEnemy = async (req, res) => {
  try {
    const federation = req.federation;

    if (!federation.enemies.includes(req.params.enemyId)) return res.status(400).json({ msg: "Esta federação não é sua inimiga." });

    federation.enemies = federation.enemies.filter(e => e.toString() !== req.params.enemyId);
    await federation.save();

    res.json({ success: true, msg: "Federação removida como inimiga com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/federations/{id}:
 *   delete:
 *     summary: Deletar uma federação
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
 *         description: Proibido, usuário não tem permissão para deletar esta federação
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.deleteFederation = async (req, res) => {
  try {
    const federation = req.federation;

    await Clan.updateMany(
      { federation: federation._id },
      { $set: { federation: null } }
    );

    await User.updateMany(
      { federation: federation._id },
      { $set: { federation: null, federationRole: null } }
    );

    await federation.deleteOne();
    res.json({ success: true, msg: "Federação deletada com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};





