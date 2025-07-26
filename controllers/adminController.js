const User = require("../models/User");
const Clan = require("../models/Clan");
const Federation = require("../models/Federation");
const cacheService = require("../services/cacheService");
const CacheKeys = require("../utils/cacheKeys");
const presenceService = require("../services/presenceService");

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Obter todos os usuários (apenas ADM)
 *     tags: [Admin]
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
 *         name: role
 *         schema:
 *           type: string
 *           enum: [User, Leader, SubLeader, ADM]
 *         description: Filtrar por role
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por username ou email
 *     responses:
 *       200:
 *         description: Lista de usuários
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
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, apenas ADMs podem acessar
 *       500:
 *         description: Erro no servidor
 */
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { role, search } = req.query;

    // Construir filtro
    let filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .populate("clan", "name tag")
      .populate("federation", "name")
      .select("-password")
      .lean()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalUsers = await User.countDocuments(filter);

    res.json({
      success: true,
      count: users.length,
      total: totalUsers,
      page,
      pages: Math.ceil(totalUsers / limit),
      data: users,
    });
  } catch (error) {
    console.error("Erro ao obter usuários:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Obter detalhes de um usuário específico (apenas ADM)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Detalhes do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, apenas ADMs podem acessar
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("clan", "name tag leader")
      .populate("federation", "name leader")
      .select("-password")
      .lean();

    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Erro ao obter usuário:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/users/{id}/role:
 *   put:
 *     summary: Alterar role de um usuário (apenas ADM)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [User, Leader, SubLeader, ADM]
 *                 description: Nova role do usuário
 *     responses:
 *       200:
 *         description: Role alterada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Erro de validação
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, apenas ADMs podem alterar roles
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ["User", "Leader", "SubLeader", "ADM"];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ msg: "Role inválida" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    user.role = role;
    await user.save();

    // Invalidar cache do usuário
    await cacheService.del(CacheKeys.user(user._id));

    res.json({
      success: true,
      msg: "Role do usuário alterada com sucesso",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Erro ao alterar role do usuário:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/users/{id}/ban:
 *   put:
 *     summary: Banir ou desbanir um usuário (apenas ADM)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - banned
 *             properties:
 *               banned:
 *                 type: boolean
 *                 description: true para banir, false para desbanir
 *               banReason:
 *                 type: string
 *                 description: Motivo do banimento (obrigatório se banned=true)
 *     responses:
 *       200:
 *         description: Status de banimento alterado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Erro de validação
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, apenas ADMs podem banir usuários
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.banUser = async (req, res) => {
  try {
    const { banned, banReason } = req.body;

    if (typeof banned !== 'boolean') {
      return res.status(400).json({ msg: "Campo 'banned' deve ser true ou false" });
    }

    if (banned && !banReason) {
      return res.status(400).json({ msg: "Motivo do banimento é obrigatório" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    if (user.role === "ADM") {
      return res.status(400).json({ msg: "Não é possível banir outro administrador" });
    }

    user.banned = banned;
    if (banned) {
      user.banReason = banReason;
      user.bannedAt = new Date();
    } else {
      user.banReason = null;
      user.bannedAt = null;
    }

    await user.save();

    // Invalidar cache do usuário
    await cacheService.del(CacheKeys.user(user._id));

    res.json({
      success: true,
      msg: banned ? "Usuário banido com sucesso" : "Usuário desbanido com sucesso",
      user: {
        id: user._id,
        username: user.username,
        banned: user.banned,
        banReason: user.banReason,
        bannedAt: user.bannedAt
      }
    });
  } catch (error) {
    console.error("Erro ao alterar status de banimento:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Deletar um usuário permanentemente (apenas ADM)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser deletado
 *     responses:
 *       200:
 *         description: Usuário deletado com sucesso
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
 *         description: Erro de validação (ex: tentar deletar outro ADM)
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, apenas ADMs podem deletar usuários
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    if (user.role === "ADM") {
      return res.status(400).json({ msg: "Não é possível deletar outro administrador" });
    }

    // Remover usuário de clãs
    if (user.clan) {
      const clan = await Clan.findById(user.clan);
      if (clan) {
        clan.members = clan.members.filter(m => m.toString() !== user._id.toString());
        clan.subLeaders = clan.subLeaders.filter(sl => sl.toString() !== user._id.toString());
        
        // Se era o líder, remover liderança
        if (clan.leader && clan.leader.toString() === user._id.toString()) {
          clan.leader = null;
        }
        
        await clan.save();
      }
    }

    // Remover usuário de federações
    if (user.federation) {
      const federation = await Federation.findById(user.federation);
      if (federation) {
        federation.subLeaders = federation.subLeaders.filter(sl => sl.toString() !== user._id.toString());
        
        // Se era o líder, remover liderança
        if (federation.leader && federation.leader.toString() === user._id.toString()) {
          federation.leader = null;
        }
        
        await federation.save();
      }
    }

    // Deletar o usuário
    await User.deleteOne({ _id: user._id });

    // Invalidar cache
    await cacheService.del(CacheKeys.user(user._id));

    res.json({ success: true, msg: "Usuário deletado com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar usuário:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Obter estatísticas gerais do sistema (apenas ADM)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas do sistema
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: integer
 *                       description: Total de usuários registrados
 *                     totalClans:
 *                       type: integer
 *                       description: Total de clãs criados
 *                     totalFederations:
 *                       type: integer
 *                       description: Total de federações criadas
 *                     bannedUsers:
 *                       type: integer
 *                       description: Total de usuários banidos
 *                     activeUsers:
 *                       type: integer
 *                       description: Usuários ativos (não banidos)
 *                     usersByRole:
 *                       type: object
 *                       description: Contagem de usuários por role
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, apenas ADMs podem acessar
 *       500:
 *         description: Erro no servidor
 */
exports.getSystemStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalClans,
      totalFederations,
      bannedUsers,
      usersByRole
    ] = await Promise.all([
      User.countDocuments({}),
      Clan.countDocuments({}),
      Federation.countDocuments({}),
      User.countDocuments({ banned: true }),
      User.aggregate([
        { $group: { _id: "$role", count: { $sum: 1 } } }
      ])
    ]);

    const activeUsers = totalUsers - bannedUsers;

    // Converter array de roles em objeto
    const roleStats = {};
    usersByRole.forEach(role => {
      roleStats[role._id] = role.count;
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        totalClans,
        totalFederations,
        bannedUsers,
        activeUsers,
        usersByRole: roleStats
      }
    });
  } catch (error) {
    console.error("Erro ao obter estatísticas:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/clans/{id}/territory:
 *   put:
 *     summary: Definir território de um clã no mapa (apenas ADM)
 *     tags: [Admin]
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
 *               - mapX
 *               - mapY
 *               - radius
 *             properties:
 *               mapX:
 *                 type: number
 *                 description: Coordenada X no mapa
 *               mapY:
 *                 type: number
 *                 description: Coordenada Y no mapa
 *               radius:
 *                 type: number
 *                 description: Raio do território
 *               color:
 *                 type: string
 *                 description: Cor do território em hexadecimal
 *     responses:
 *       200:
 *         description: Território definido com sucesso
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
 *         description: Proibido, apenas ADMs podem definir territórios
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.setClanTerritory = async (req, res) => {
  try {
    const { mapX, mapY, radius, color } = req.body;

    if (typeof mapX !== 'number' || typeof mapY !== 'number' || typeof radius !== 'number') {
      return res.status(400).json({ msg: "Coordenadas e raio devem ser números" });
    }

    const clan = await Clan.findById(req.params.id);
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    clan.territory = {
      mapX: mapX,
      mapY: mapY,
      radius: radius,
      color: color || "#FF0000"
    };

    await clan.save();

    // Invalidar cache
    await cacheService.del(CacheKeys.clan(clan._id));

    res.json({
      success: true,
      msg: "Território do clã definido com sucesso",
      clan: clan
    });
  } catch (error) {
    console.error("Erro ao definir território do clã:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/federations/{id}/territory:
 *   put:
 *     summary: Definir território de uma federação no mapa (apenas ADM)
 *     tags: [Admin]
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
 *                 description: Coordenada X no mapa
 *               mapY:
 *                 type: number
 *                 description: Coordenada Y no mapa
 *               radius:
 *                 type: number
 *                 description: Raio do território
 *               color:
 *                 type: string
 *                 description: Cor do território em hexadecimal
 *     responses:
 *       200:
 *         description: Território definido com sucesso
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
 *       400:
 *         description: Erro de validação
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, apenas ADMs podem definir territórios
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.setFederationTerritory = async (req, res) => {
  try {
    const { mapX, mapY, radius, color } = req.body;

    if (typeof mapX !== 'number' || typeof mapY !== 'number' || typeof radius !== 'number') {
      return res.status(400).json({ msg: "Coordenadas e raio devem ser números" });
    }

    const federation = await Federation.findById(req.params.id);
    if (!federation) {
      return res.status(404).json({ msg: "Federação não encontrada" });
    }

    federation.territory = {
      mapX: mapX,
      mapY: mapY,
      radius: radius,
      color: color || "#00FF00"
    };

    await federation.save();

    // Invalidar cache
    await cacheService.del(CacheKeys.federation(federation._id));

    res.json({
      success: true,
      msg: "Território da federação definido com sucesso",
      federation: federation
    });
  } catch (error) {
    console.error("Erro ao definir território da federação:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/purge-my-affiliations:
 *   post:
 *     summary: Remover o ADM de todos os clãs e federações, com destruição condicional (apenas ADM)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Purga realizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 summary:
 *                   type: object
 *                   properties:
 *                     clansLeft:
 *                       type: integer
 *                       description: Número de clãs dos quais saiu
 *                     clansDestroyed:
 *                       type: integer
 *                       description: Número de clãs destruídos
 *                     federationsLeft:
 *                       type: integer
 *                       description: Número de federações das quais saiu
 *                     federationsDestroyed:
 *                       type: integer
 *                       description: Número de federações destruídas
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, apenas ADMs podem usar esta função
 *       500:
 *         description: Erro no servidor
 */
exports.purgeMyAffiliations = async (req, res) => {
  try {
    const adminId = req.user.id;
    let summary = {
      clansLeft: 0,
      clansDestroyed: 0,
      federationsLeft: 0,
      federationsDestroyed: 0
    };

    // ✅ CORREÇÃO: Buscar clãs onde o ADM é líder ou membro
    const clansAsLeader = await Clan.find({ leader: adminId });
    const clansAsMember = await Clan.find({ 
      members: adminId,
      leader: { $ne: adminId } // Não incluir clãs onde já é líder
    });

    // Processar clãs onde é líder
    for (const clan of clansAsLeader) {
      // Verificar se há outros membros que podem ser líderes
      const otherMembers = clan.members.filter(memberId => memberId.toString() !== adminId);
      
      if (otherMembers.length > 0) {
        // Transferir liderança para o primeiro membro disponível
        const newLeaderId = otherMembers[0];
        const newLeader = await User.findById(newLeaderId);
        
        if (newLeader) {
          clan.leader = newLeaderId;
          clan.members = clan.members.filter(memberId => memberId.toString() !== adminId);
          
          newLeader.clanRole = "Leader";
          await newLeader.save();
          await clan.save();
          
          summary.clansLeft++;
        } else {
          // Se o novo líder não existe, destruir o clã
          await Clan.deleteOne({ _id: clan._id });
          await User.updateMany(
            { clan: clan._id },
            { $unset: { clan: "", clanRole: "" } }
          );
          summary.clansDestroyed++;
        }
      } else {
        // Não há outros membros, destruir o clã
        await Clan.deleteOne({ _id: clan._id });
        summary.clansDestroyed++;
      }
    }

    // Processar clãs onde é apenas membro
    for (const clan of clansAsMember) {
      clan.members = clan.members.filter(memberId => memberId.toString() !== adminId);
      clan.subLeaders = clan.subLeaders.filter(subLeaderId => subLeaderId.toString() !== adminId);
      await clan.save();
      summary.clansLeft++;
    }

    // ✅ CORREÇÃO: Buscar federações onde o ADM é líder ou sub-líder
    const federationsAsLeader = await Federation.find({ leader: adminId });
    const federationsAsSubLeader = await Federation.find({ 
      subLeaders: adminId,
      leader: { $ne: adminId } // Não incluir federações onde já é líder
    });

    // Processar federações onde é líder
    for (const federation of federationsAsLeader) {
      // Verificar se há sub-líderes que podem assumir a liderança
      const availableSubLeaders = federation.subLeaders.filter(subLeaderId => subLeaderId.toString() !== adminId);
      
      if (availableSubLeaders.length > 0) {
        // Transferir liderança para o primeiro sub-líder disponível
        const newLeaderId = availableSubLeaders[0];
        const newLeader = await User.findById(newLeaderId);
        
        if (newLeader) {
          federation.leader = newLeaderId;
          federation.subLeaders = federation.subLeaders.filter(subLeaderId => subLeaderId.toString() !== adminId);
          
          newLeader.federationRole = "leader";
          await newLeader.save();
          await federation.save();
          
          summary.federationsLeft++;
        } else {
          // Se o novo líder não existe, destruir a federação
          await Federation.deleteOne({ _id: federation._id });
          await User.updateMany(
            { federation: federation._id },
            { $unset: { federation: "", federationRole: "" } }
          );
          await Clan.updateMany(
            { federation: federation._id },
            { $unset: { federation: "" } }
          );
          summary.federationsDestroyed++;
        }
      } else {
        // Não há sub-líderes, destruir a federação
        await Federation.deleteOne({ _id: federation._id });
        await User.updateMany(
          { federation: federation._id },
          { $unset: { federation: "", federationRole: "" } }
        );
        await Clan.updateMany(
          { federation: federation._id },
          { $unset: { federation: "" } }
        );
        summary.federationsDestroyed++;
      }
    }

    // Processar federações onde é apenas sub-líder
    for (const federation of federationsAsSubLeader) {
      federation.subLeaders = federation.subLeaders.filter(subLeaderId => subLeaderId.toString() !== adminId);
      await federation.save();
      summary.federationsLeft++;
    }

    // Limpar dados do ADM
    const admin = await User.findById(adminId);
    admin.clan = null;
    admin.clanRole = null;
    admin.federation = null;
    admin.federationRole = null;
    await admin.save();

    // Invalidar caches relevantes
    await cacheService.del(CacheKeys.user(adminId));
    await cacheService.del(CacheKeys.clanList('all'));
    await cacheService.del(CacheKeys.federationList());

    res.json({
      success: true,
      message: "Purga de afiliações realizada com sucesso",
      summary: summary
    });

  } catch (error) {
    console.error("Erro na purga de afiliações:", error);
    res.status(500).json({ 
      success: false, 
      message: "Erro interno do servidor durante a purga" 
    });
  }
};


/**
 * @swagger
 * /api/admin/dashboard-stats:
 *   get:
 *     summary: Obter estatísticas do dashboard
 *     tags: [Admin]
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalClans = await Clan.countDocuments();
    const totalFederations = await Federation.countDocuments();
    const activeUsers = await User.countDocuments({ lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalClans,
        totalFederations,
        activeUsers
      }
    });
  } catch (error) {
    console.error("Erro ao obter estatísticas:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/federation/{id}/territory:
 *   put:
 *     summary: Definir território da federação
 *     tags: [Admin]
 */
exports.setFederationTerritory = async (req, res) => {
  try {
    const { id } = req.params;
    const { center, radius } = req.body;

    const federation = await Federation.findById(id);
    if (!federation) {
      return res.status(404).json({ msg: "Federação não encontrada" });
    }

    federation.territory = { center, radius };
    await federation.save();

    res.json({ success: true, msg: "Território da federação definido com sucesso!" });
  } catch (error) {
    console.error("Erro ao definir território:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/users/{userId}/role:
 *   put:
 *     summary: Definir role do usuário
 *     tags: [Admin]
 */
exports.setUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    user.role = role;
    await user.save();

    res.json({ success: true, msg: "Role do usuário atualizada com sucesso!" });
  } catch (error) {
    console.error("Erro ao definir role:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   delete:
 *     summary: Deletar usuário
 *     tags: [Admin]
 */
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    await User.deleteOne({ _id: userId });

    res.json({ success: true, msg: "Usuário deletado com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar usuário:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/users/{userId}/ban:
 *   put:
 *     summary: Banir usuário
 *     tags: [Admin]
 */
exports.banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    user.banned = true;
    user.banReason = reason;
    await user.save();

    res.json({ success: true, msg: "Usuário banido com sucesso!" });
  } catch (error) {
    console.error("Erro ao banir usuário:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/users/{userId}/unban:
 *   put:
 *     summary: Desbanir usuário
 *     tags: [Admin]
 */
exports.unbanUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    user.banned = false;
    user.banReason = undefined;
    await user.save();

    res.json({ success: true, msg: "Usuário desbanido com sucesso!" });
  } catch (error) {
    console.error("Erro ao desbanir usuário:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/users/{userId}/suspend:
 *   put:
 *     summary: Suspender usuário
 *     tags: [Admin]
 */
exports.suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, duration } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    user.suspended = true;
    user.suspensionReason = reason;
    user.suspensionExpires = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    await user.save();

    res.json({ success: true, msg: "Usuário suspenso com sucesso!" });
  } catch (error) {
    console.error("Erro ao suspender usuário:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/users/{userId}/unsuspend:
 *   put:
 *     summary: Remover suspensão do usuário
 *     tags: [Admin]
 */
exports.unsuspendUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    user.suspended = false;
    user.suspensionReason = undefined;
    user.suspensionExpires = undefined;
    await user.save();

    res.json({ success: true, msg: "Suspensão removida com sucesso!" });
  } catch (error) {
    console.error("Erro ao remover suspensão:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/logs:
 *   get:
 *     summary: Obter logs do sistema
 *     tags: [Admin]
 */
exports.getLogs = async (req, res) => {
  try {
    const logs = await Log.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, logs });
  } catch (error) {
    console.error("Erro ao obter logs:", error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

// Adicionar ao module.exports existente
module.exports = {
  ...module.exports,
  getDashboardStats: exports.getDashboardStats,
  setFederationTerritory: exports.setFederationTerritory,
  setUserRole: exports.setUserRole,
  deleteUser: exports.deleteUser,
  banUser: exports.banUser,
  unbanUser: exports.unbanUser,
  suspendUser: exports.suspendUser,
  unsuspendUser: exports.unsuspendUser,
  getLogs: exports.getLogs
};


/**
 * Middleware para verificar se o usuário é administrador
 */
exports.checkAdmin = (req, res, next) => {
  if (req.user.role !== "ADM") {
    return res.status(403).json({ msg: "Acesso negado. Apenas administradores podem acessar esta funcionalidade." });
  }
  next();
};

// Atualizar module.exports
module.exports = {
  ...module.exports,
  checkAdmin: exports.checkAdmin
};



const SystemConfig = require("../models/SystemConfig");

exports.getSystemSettings = async (req, res) => {
  try {
    const settings = await SystemConfig.findOne();
    if (!settings) {
      return res.status(404).json({ success: false, message: "Configurações do sistema não encontradas." });
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("Erro ao obter configurações do sistema:", error);
    res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }
};



/**
 * @swagger
 * /api/admin/clans:
 *   post:
 *     summary: Criar um novo clã (apenas ADM)
 *     tags: [Admin]
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
 *                 description: Tag do clã
 *               description:
 *                 type: string
 *                 description: Descrição do clã
 *               leaderUsername:
 *                 type: string
 *                 description: Nome de usuário do líder (opcional)
 *     responses:
 *       201:
 *         description: Clã criado com sucesso
 *       400:
 *         description: Dados inválidos ou clã já existe
 *       404:
 *         description: Usuário líder não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
exports.createClan = async (req, res) => {
  try {
    const { name, tag, description, leaderUsername } = req.body;

    // Verificar se já existe um clã com o mesmo nome ou tag
    const existingClan = await Clan.findOne({
      $or: [{ name }, { tag }]
    });

    if (existingClan) {
      return res.status(400).json({
        success: false,
        message: "Já existe um clã com este nome ou tag"
      });
    }

    let leader = null;
    if (leaderUsername) {
      leader = await User.findOne({ username: leaderUsername });
      if (!leader) {
        return res.status(404).json({
          success: false,
          message: "Usuário líder não encontrado"
        });
      }
    }

    // Criar o clã
    const newClan = new Clan({
      name,
      tag,
      description: description || "",
      leader: leader ? leader._id : null,
      members: leader ? [leader._id] : [],
      subLeaders: [],
      createdAt: new Date()
    });

    await newClan.save();

    // Se há um líder, atualizar os dados do usuário
    if (leader) {
      leader.clan = newClan._id;
      leader.clanRole = "Leader";
      await leader.save();
    }

    // Invalidar cache
    await cacheService.del(CacheKeys.clanList('all'));

    res.status(201).json({
      success: true,
      message: "Clã criado com sucesso",
      clan: newClan
    });

  } catch (error) {
    console.error("Erro ao criar clã:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
};

/**
 * @swagger
 * /api/admin/clans/{clanName}/assign-leader:
 *   put:
 *     summary: Atribuir líder a um clã pelo nome (apenas ADM)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clanName
 *         schema:
 *           type: string
 *         required: true
 *         description: Nome do clã
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *                 description: Nome de usuário do novo líder
 *     responses:
 *       200:
 *         description: Líder atribuído com sucesso
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
exports.assignClanLeaderByName = async (req, res) => {
  try {
    const { clanName } = req.params;
    const { username } = req.body;

    // Buscar o clã pelo nome
    const clan = await Clan.findOne({ name: clanName });
    if (!clan) {
      return res.status(404).json({
        success: false,
        message: "Clã não encontrado"
      });
    }

    // Buscar o usuário pelo nome
    const newLeader = await User.findOne({ username });
    if (!newLeader) {
      return res.status(404).json({
        success: false,
        message: "Usuário não encontrado"
      });
    }

    // Remover liderança do líder anterior (se existir)
    if (clan.leader) {
      const oldLeader = await User.findById(clan.leader);
      if (oldLeader) {
        oldLeader.clanRole = "Member";
        await oldLeader.save();
      }
    }

    // Atribuir novo líder
    clan.leader = newLeader._id;
    
    // Adicionar o novo líder aos membros se não estiver
    if (!clan.members.includes(newLeader._id)) {
      clan.members.push(newLeader._id);
    }

    // Remover das sublideranças se estiver
    clan.subLeaders = clan.subLeaders.filter(
      subLeaderId => subLeaderId.toString() !== newLeader._id.toString()
    );

    await clan.save();

    // Atualizar dados do novo líder
    newLeader.clan = clan._id;
    newLeader.clanRole = "Leader";
    await newLeader.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.user(newLeader._id));

    res.json({
      success: true,
      message: `${username} foi definido como líder do clã ${clanName}`,
      clan: clan,
      newLeader: {
        id: newLeader._id,
        username: newLeader.username,
        role: newLeader.clanRole
      }
    });

  } catch (error) {
    console.error("Erro ao atribuir líder do clã:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
};

/**
 * @swagger
 * /api/admin/clans/{clanName}/assign-member:
 *   put:
 *     summary: Adicionar membro a um clã pelo nome (apenas ADM)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clanName
 *         schema:
 *           type: string
 *         required: true
 *         description: Nome do clã
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *                 description: Nome de usuário do novo membro
 *               role:
 *                 type: string
 *                 enum: [Member, SubLeader]
 *                 default: Member
 *                 description: Papel do membro no clã
 *     responses:
 *       200:
 *         description: Membro adicionado com sucesso
 *       404:
 *         description: Clã ou usuário não encontrado
 *       400:
 *         description: Usuário já é membro do clã
 *       500:
 *         description: Erro interno do servidor
 */
exports.assignClanMemberByName = async (req, res) => {
  try {
    const { clanName } = req.params;
    const { username, role = "Member" } = req.body;

    // Buscar o clã pelo nome
    const clan = await Clan.findOne({ name: clanName });
    if (!clan) {
      return res.status(404).json({
        success: false,
        message: "Clã não encontrado"
      });
    }

    // Buscar o usuário pelo nome
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuário não encontrado"
      });
    }

    // Verificar se o usuário já é membro do clã
    if (clan.members.includes(user._id)) {
      return res.status(400).json({
        success: false,
        message: "Usuário já é membro deste clã"
      });
    }

    // Remover de clã anterior se existir
    if (user.clan) {
      const oldClan = await Clan.findById(user.clan);
      if (oldClan) {
        oldClan.members = oldClan.members.filter(
          memberId => memberId.toString() !== user._id.toString()
        );
        oldClan.subLeaders = oldClan.subLeaders.filter(
          subLeaderId => subLeaderId.toString() !== user._id.toString()
        );
        
        // Se era líder, remover liderança
        if (oldClan.leader && oldClan.leader.toString() === user._id.toString()) {
          oldClan.leader = null;
        }
        
        await oldClan.save();
        await cacheService.del(CacheKeys.clan(oldClan._id));
      }
    }

    // Adicionar ao novo clã
    clan.members.push(user._id);
    
    if (role === "SubLeader") {
      clan.subLeaders.push(user._id);
    }

    await clan.save();

    // Atualizar dados do usuário
    user.clan = clan._id;
    user.clanRole = role;
    await user.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.user(user._id));

    res.json({
      success: true,
      message: `${username} foi adicionado ao clã ${clanName} como ${role}`,
      clan: clan,
      member: {
        id: user._id,
        username: user.username,
        role: user.clanRole
      }
    });

  } catch (error) {
    console.error("Erro ao adicionar membro ao clã:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
};


/**
 * @swagger
 * /api/admin/clans:
 *   post:
 *     summary: Criar um novo clã (apenas ADM)
 *     tags: [Admin]
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
 *                 description: Tag do clã
 *               description:
 *                 type: string
 *                 description: Descrição do clã
 *               leaderUsername:
 *                 type: string
 *                 description: Nome de usuário do líder (opcional)
 *     responses:
 *       201:
 *         description: Clã criado com sucesso
 *       400:
 *         description: Dados inválidos ou clã já existe
 *       404:
 *         description: Usuário líder não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
exports.createClan = async (req, res) => {
  try {
    const { name, tag, description, leaderUsername } = req.body;

    // Verificar se já existe um clã com o mesmo nome ou tag
    const existingClan = await Clan.findOne({
      $or: [{ name }, { tag }]
    });

    if (existingClan) {
      return res.status(400).json({
        success: false,
        message: "Já existe um clã com este nome ou tag"
      });
    }

    let leader = null;
    if (leaderUsername) {
      leader = await User.findOne({ username: leaderUsername });
      if (!leader) {
        return res.status(404).json({
          success: false,
          message: "Usuário líder não encontrado"
        });
      }
    }

    // Criar o clã
    const newClan = new Clan({
      name,
      tag,
      description: description || "",
      leader: leader ? leader._id : null,
      members: leader ? [leader._id] : [],
      subLeaders: [],
      createdAt: new Date()
    });

    await newClan.save();

    // Se há um líder, atualizar os dados do usuário
    if (leader) {
      leader.clan = newClan._id;
      leader.clanRole = "Leader";
      await leader.save();
      
      // Invalidar cache do usuário
      await cacheService.del(CacheKeys.user(leader._id));
    }

    // Invalidar cache
    await cacheService.del(CacheKeys.clanList('all'));

    // Emitir evento em tempo real para todos os usuários conectados
    const io = req.app.get('socketio');
    if (io) {
      io.emit('clan_created', {
        clan: newClan,
        leader: leader ? { id: leader._id, username: leader.username } : null,
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({
      success: true,
      message: "Clã criado com sucesso",
      clan: newClan
    });

  } catch (error) {
    console.error("Erro ao criar clã:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
};

/**
 * @swagger
 * /api/admin/clans/{clanName}/assign-leader:
 *   put:
 *     summary: Atribuir líder a um clã pelo nome (apenas ADM)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clanName
 *         schema:
 *           type: string
 *         required: true
 *         description: Nome do clã
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *                 description: Nome de usuário do novo líder
 *     responses:
 *       200:
 *         description: Líder atribuído com sucesso
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
exports.assignClanLeaderByName = async (req, res) => {
  try {
    const { clanName } = req.params;
    const { username } = req.body;

    // Buscar o clã pelo nome
    const clan = await Clan.findOne({ name: clanName });
    if (!clan) {
      return res.status(404).json({
        success: false,
        message: "Clã não encontrado"
      });
    }

    // Buscar o usuário pelo nome
    const newLeader = await User.findOne({ username });
    if (!newLeader) {
      return res.status(404).json({
        success: false,
        message: "Usuário não encontrado"
      });
    }

    let oldLeader = null;
    // Remover liderança do líder anterior (se existir)
    if (clan.leader) {
      oldLeader = await User.findById(clan.leader);
      if (oldLeader) {
        oldLeader.clanRole = "Member";
        await oldLeader.save();
        await cacheService.del(CacheKeys.user(oldLeader._id));
      }
    }

    // Atribuir novo líder
    clan.leader = newLeader._id;
    
    // Adicionar o novo líder aos membros se não estiver
    if (!clan.members.includes(newLeader._id)) {
      clan.members.push(newLeader._id);
    }

    // Remover das sublideranças se estiver
    clan.subLeaders = clan.subLeaders.filter(
      subLeaderId => subLeaderId.toString() !== newLeader._id.toString()
    );

    await clan.save();

    // Atualizar dados do novo líder
    newLeader.clan = clan._id;
    newLeader.clanRole = "Leader";
    await newLeader.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.user(newLeader._id));

    // Emitir evento em tempo real
    const io = req.app.get('socketio');
    if (io) {
      io.emit('clan_leader_changed', {
        clanId: clan._id,
        clanName: clan.name,
        newLeader: {
          id: newLeader._id,
          username: newLeader.username
        },
        oldLeader: oldLeader ? {
          id: oldLeader._id,
          username: oldLeader.username
        } : null,
        timestamp: new Date().toISOString()
      });

      // Notificar membros do clã
      clan.members.forEach(async (memberId) => {
        const memberSocketId = await presenceService.getSocketId(memberId.toString());
        if (memberSocketId) {
          io.to(memberSocketId).emit('clan_leadership_update', {
            message: `${username} agora é o líder do clã ${clanName}`,
            clanId: clan._id,
            newLeaderId: newLeader._id
          });
        }
      });
    }

    res.json({
      success: true,
      message: `${username} foi definido como líder do clã ${clanName}`,
      clan: clan,
      newLeader: {
        id: newLeader._id,
        username: newLeader.username,
        role: newLeader.clanRole
      }
    });

  } catch (error) {
    console.error("Erro ao atribuir líder do clã:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
};

/**
 * @swagger
 * /api/admin/clans/{clanName}/assign-member:
 *   put:
 *     summary: Adicionar membro a um clã pelo nome (apenas ADM)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clanName
 *         schema:
 *           type: string
 *         required: true
 *         description: Nome do clã
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *                 description: Nome de usuário do novo membro
 *               role:
 *                 type: string
 *                 enum: [Member, SubLeader]
 *                 default: Member
 *                 description: Papel do membro no clã
 *     responses:
 *       200:
 *         description: Membro adicionado com sucesso
 *       404:
 *         description: Clã ou usuário não encontrado
 *       400:
 *         description: Usuário já é membro do clã
 *       500:
 *         description: Erro interno do servidor
 */
exports.assignClanMemberByName = async (req, res) => {
  try {
    const { clanName } = req.params;
    const { username, role = "Member" } = req.body;

    // Buscar o clã pelo nome
    const clan = await Clan.findOne({ name: clanName });
    if (!clan) {
      return res.status(404).json({
        success: false,
        message: "Clã não encontrado"
      });
    }

    // Buscar o usuário pelo nome
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuário não encontrado"
      });
    }

    // Verificar se o usuário já é membro do clã
    if (clan.members.includes(user._id)) {
      return res.status(400).json({
        success: false,
        message: "Usuário já é membro deste clã"
      });
    }

    let oldClan = null;
    // Remover de clã anterior se existir
    if (user.clan) {
      oldClan = await Clan.findById(user.clan);
      if (oldClan) {
        oldClan.members = oldClan.members.filter(
          memberId => memberId.toString() !== user._id.toString()
        );
        oldClan.subLeaders = oldClan.subLeaders.filter(
          subLeaderId => subLeaderId.toString() !== user._id.toString()
        );
        
        // Se era líder, remover liderança
        if (oldClan.leader && oldClan.leader.toString() === user._id.toString()) {
          oldClan.leader = null;
        }
        
        await oldClan.save();
        await cacheService.del(CacheKeys.clan(oldClan._id));
      }
    }

    // Adicionar ao novo clã
    clan.members.push(user._id);
    
    if (role === "SubLeader") {
      clan.subLeaders.push(user._id);
    }

    await clan.save();

    // Atualizar dados do usuário
    user.clan = clan._id;
    user.clanRole = role;
    await user.save();

    // Invalidar caches
    await cacheService.del(CacheKeys.clan(clan._id));
    await cacheService.del(CacheKeys.user(user._id));

    // Emitir evento em tempo real
    const io = req.app.get('socketio');
    if (io) {
      io.emit('clan_member_added', {
        clanId: clan._id,
        clanName: clan.name,
        member: {
          id: user._id,
          username: user.username,
          role: role
        },
        oldClan: oldClan ? {
          id: oldClan._id,
          name: oldClan.name
        } : null,
        timestamp: new Date().toISOString()
      });

      // Notificar o usuário
      const userSocketId = await presenceService.getSocketId(user._id.toString());
      if (userSocketId) {
        io.to(userSocketId).emit('clan_membership_update', {
          message: `Você foi adicionado ao clã ${clanName} como ${role}`,
          clanId: clan._id,
          clanName: clan.name,
          role: role
        });
      }

      // Notificar membros do clã
      clan.members.forEach(async (memberId) => {
        if (memberId.toString() !== user._id.toString()) {
          const memberSocketId = await presenceService.getSocketId(memberId.toString());
          if (memberSocketId) {
            io.to(memberSocketId).emit('clan_new_member', {
              message: `${username} entrou no clã como ${role}`,
              clanId: clan._id,
              newMember: {
                id: user._id,
                username: user.username,
                role: role
              }
            });
          }
        }
      });
    }

    res.json({
      success: true,
      message: `${username} foi adicionado ao clã ${clanName} como ${role}`,
      clan: clan,
      member: {
        id: user._id,
        username: user.username,
        role: user.clanRole
      }
    });

  } catch (error) {
    console.error("Erro ao adicionar membro ao clã:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
};



/**
 * @swagger
 * /api/admin/federations/create-with-territory:
 *   post:
 *     summary: Criar uma nova federação com território no mapa (apenas ADM)
 *     tags: [Admin]
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
 *               - mapX
 *               - mapY
 *               - radius
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome da nova federação
 *               tag:
 *                 type: string
 *                 description: TAG da federação (opcional)
 *               leaderUsername:
 *                 type: string
 *                 description: Username do usuário a ser definido como líder (opcional)
 *               mapX:
 *                 type: number
 *                 description: Coordenada X do centro do território no mapa
 *               mapY:
 *                 type: number
 *                 description: Coordenada Y do centro do território no mapa
 *               radius:
 *                 type: number
 *                 description: Raio do território no mapa
 *               color:
 *                 type: string
 *                 description: Cor do território em hexadecimal (opcional)
 *     responses:
 *       201:
 *         description: Federação criada com sucesso
 *       400:
 *         description: Dados inválidos ou federação já existe
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, apenas ADMs podem criar federações
 *       500:
 *         description: Erro no servidor
 */
exports.createFederationWithTerritory = async (req, res) => {
  try {
    const { name, tag, leaderUsername, mapX, mapY, radius, color } = req.body;

    if (!name || mapX === undefined || mapY === undefined || radius === undefined) {
      return res.status(400).json({ msg: "Nome, coordenadas e raio são obrigatórios." });
    }

    let leader = null;
    if (leaderUsername) {
      leader = await User.findOne({ username: leaderUsername });
      if (!leader) {
        return res.status(404).json({ msg: "Líder especificado não encontrado." });
      }
    } else {
      // Se nenhum líder for especificado, o ADM que está criando se torna o líder
      leader = req.user; // req.user é o usuário autenticado (ADM)
    }

    const newFederation = new Federation({
      name,
      tag,
      leader: leader._id,
      territory: {
        mapX,
        mapY,
        radius,
        color: color || '#FFFFFF' // Cor padrão branca se não especificada
      }
    });

    await newFederation.save();

    // Atualizar o usuário para ser líder da federação
    leader.role = 'FederationLeader';
    leader.federation = newFederation._id;
    await leader.save();

    // Invalidar cache de federações e do usuário líder
    await cacheService.del(CacheKeys.federations());
    await cacheService.del(CacheKeys.user(leader._id));

    // Notificar via Socket.IO sobre a nova federação
    presenceService.emitFederationCreated(newFederation);

    res.status(201).json({ success: true, data: newFederation, msg: "Federação criada com sucesso!" });
  } catch (error) {
    console.error("Erro ao criar federação com território:", error);
    if (error.code === 11000) { // Erro de duplicidade (nome ou tag)
      return res.status(400).json({ msg: "Nome ou TAG da federação já existe." });
    }
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

/**
 * @swagger
 * /api/admin/clans/create-with-territory:
 *   post:
 *     summary: Criar um novo clã com território dentro de uma federação (apenas ADM)
 *     tags: [Admin]
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
 *               - federationId
 *               - mapX
 *               - mapY
 *               - radius
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome do novo clã
 *               tag:
 *                 type: string
 *                 description: TAG do clã
 *               federationId:
 *                 type: string
 *                 description: ID da federação à qual o clã pertencerá
 *               leaderUsername:
 *                 type: string
 *                 description: Username do usuário a ser definido como líder (opcional)
 *               mapX:
 *                 type: number
 *                 description: Coordenada X do centro do território do clã no mapa
 *               mapY:
 *                 type: number
 *                 description: Coordenada Y do centro do território do clã no mapa
 *               radius:
 *                 type: number
 *                 description: Raio do território do clã no mapa
 *     responses:
 *       201:
 *         description: Clã criado com sucesso
 *       400:
 *         description: Dados inválidos ou clã já existe
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, apenas ADMs podem criar clãs
 *       404:
 *         description: Federação não encontrada ou líder especificado não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.createClanWithTerritory = async (req, res) => {
  try {
    const { name, tag, federationId, leaderUsername, mapX, mapY, radius } = req.body;

    if (!name || !tag || !federationId || mapX === undefined || mapY === undefined || radius === undefined) {
      return res.status(400).json({ msg: "Nome, TAG, ID da federação, coordenadas e raio são obrigatórios." });
    }

    const federation = await Federation.findById(federationId);
    if (!federation) {
      return res.status(404).json({ msg: "Federação não encontrada." });
    }

    let leader = null;
    if (leaderUsername) {
      leader = await User.findOne({ username: leaderUsername });
      if (!leader) {
        return res.status(404).json({ msg: "Líder especificado não encontrado." });
      }
    }

    const newClan = new Clan({
      name,
      tag,
      federation: federationId,
      leader: leader ? leader._id : null, // Opcional: líder pode ser nulo inicialmente
      territory: {
        mapX,
        mapY,
        radius
      }
    });

    await newClan.save();

    // Adicionar o clã à federação
    federation.clans.push(newClan._id);
    await federation.save();

    // Se um líder foi atribuído, atualizar seu role e clanId
    if (leader) {
      leader.role = 'Leader';
      leader.clan = newClan._id;
      await leader.save();
    }

    // Invalidar cache de clãs, federações e do usuário líder (se houver)
    await cacheService.del(CacheKeys.clans());
    await cacheService.del(CacheKeys.federation(federationId));
    if (leader) {
      await cacheService.del(CacheKeys.user(leader._id));
    }

    // Notificar via Socket.IO sobre o novo clã
    presenceService.emitClanCreated(newClan);

    res.status(201).json({ success: true, data: newClan, msg: "Clã criado com sucesso!" });
  } catch (error) {
    console.error("Erro ao criar clã com território:", error);
    if (error.code === 11000) { // Erro de duplicidade (nome ou tag)
      return res.status(400).json({ msg: "Nome ou TAG do clã já existe." });
    }
    res.status(500).json({ msg: "Erro no servidor" });
  }
};

