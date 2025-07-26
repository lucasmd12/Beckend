const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { protect } = require("../middleware/authMiddleware");
const { check } = require("express-validator");

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Rotas de administração do sistema
 */

/**
 * @swagger
 * /api/admin/dashboard-stats:
 *   get:
 *     summary: Obter estatísticas para o dashboard do ADM
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas do dashboard
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
 *                     totalClans:
 *                       type: integer
 *                     totalFederations:
 *                       type: integer
 *                     activeCalls:
 *                       type: integer
 *                     onlineUsers:
 *                       type: integer
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       500:
 *         description: Erro no servidor
 */
router.get("/dashboard-stats", protect, adminController.checkAdmin, adminController.getDashboardStats);

/**
 * @swagger
 * /api/admin/settings:
 *   get:
 *     summary: Obter configurações do sistema (apenas ADM)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações do sistema retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: Objeto com as configurações do sistema
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Configurações não encontradas
 *       500:
 *         description: Erro no servidor
 */
router.get("/settings", protect, adminController.checkAdmin, adminController.getSystemSettings);

/**
 * @swagger
 * /api/admin/purge-my-affiliations:
 *   post:
 *     summary: Purgar todas as afiliações do ADM (clãs e federações) com lógica de destruição condicional
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Remove o ADM de todos os clãs e federações onde ele está presente. 
 *       Se o ADM for o único líder de um clã/federação, a organização será destruída.
 *       Se houver outros líderes, o ADM será apenas removido e a liderança transferida.
 *     responses:
 *       200:
 *         description: Afiliações processadas com sucesso
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
 *                   type: object
 *                   properties:
 *                     clansLeft:
 *                       type: integer
 *                       description: Número de clãs dos quais o ADM saiu (mas que continuam existindo)
 *                     clansDestroyed:
 *                       type: integer
 *                       description: Número de clãs que foram destruídos
 *                     federationsLeft:
 *                       type: integer
 *                       description: Número de federações das quais o ADM saiu (mas que continuam existindo)
 *                     federationsDestroyed:
 *                       type: integer
 *                       description: Número de federações que foram destruídas
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado (apenas ADMs podem usar esta função)
 *       404:
 *         description: Usuário ADM não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.post("/purge-my-affiliations", protect, adminController.checkAdmin, adminController.purgeMyAffiliations);

/**
 * @swagger
 * /api/admin/federations/{federationId}/territory:
 *   put:
 *     summary: Definir ou atualizar o território de uma federação (ADM)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: federationId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação a ser atualizada.
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
 *               - color
 *             properties:
 *               mapX:
 *                 type: number
 *                 description: Coordenada X do centro do território no mapa.
 *               mapY:
 *                 type: number
 *                 description: Coordenada Y do centro do território no mapa.
 *               radius:
 *                 type: number
 *                 description: Raio do território no mapa.
 *               color:
 *                 type: string
 *                 description: "Cor do território em formato hexadecimal (ex: '#FF0000')."
 *     responses:
 *       200:
 *         description: Território da federação atualizado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Federation'
 *       400:
 *         description: Dados inválidos na requisição.
 *       401:
 *         description: Não autorizado.
 *       403:
 *         description: Acesso negado.
 *       404:
 *         description: Federação não encontrada.
 *       500:
 *         description: Erro no servidor.
 */
router.put(
    "/federations/:federationId/territory",
    protect,
    adminController.checkAdmin,
    [
        check("mapX", "A coordenada mapX é obrigatória e deve ser um número.").isNumeric(),
        check("mapY", "A coordenada mapY é obrigatória e deve ser um número.").isNumeric(),
        check("radius", "O raio (radius) é obrigatório e deve ser um número.").isNumeric(),
        check("color", "A cor (color) é obrigatória e deve ser uma string hexadecimal válida.").isHexColor(),
    ],
    adminController.setFederationTerritory
);


/**
 * @swagger
 * /api/admin/users/{userId}/set-role:
 *   put:
 *     summary: Definir o papel (role) de um usuário
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *                 enum: [user, leader, subLeader, ADM]
 *                 description: Novo papel do usuário
 *     responses:
 *       200:
 *         description: Papel do usuário atualizado com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put(
  "/users/:userId/set-role",
  protect,
  adminController.checkAdmin,
  [check("role", "O papel é obrigatório e deve ser um dos válidos.").isIn(["user", "leader", "subLeader", "ADM"])],
  adminController.setUserRole
);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   delete:
 *     summary: Apagar uma conta de usuário
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser apagado
 *     responses:
 *       200:
 *         description: Usuário apagado com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.delete("/users/:userId", protect, adminController.checkAdmin, adminController.deleteUser);

/**
 * @swagger
 * /api/admin/users/{userId}/ban:
 *   put:
 *     summary: Banir um usuário
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser banido
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Motivo do banimento
 *     responses:
 *       200:
 *         description: Usuário banido com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/users/:userId/ban", protect, adminController.checkAdmin, adminController.banUser);

/**
 * @swagger
 * /api/admin/users/{userId}/unban:
 *   put:
 *     summary: Desbanir um usuário
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser desbanido
 *     responses:
 *       200:
 *         description: Usuário desbanido com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/users/:userId/unban", protect, adminController.checkAdmin, adminController.unbanUser);

/**
 * @swagger
 * /api/admin/users/{userId}/suspend:
 *   put:
 *     summary: Suspender um usuário
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ser suspenso
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - durationDays
 *             properties:
 *               durationDays:
 *                 type: integer
 *                 description: Duração da suspensão em dias
 *               reason:
 *                 type: string
 *                 description: Motivo da suspensão
 *     responses:
 *       200:
 *         description: Usuário suspenso com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/users/:userId/suspend", protect, adminController.checkAdmin, [
  check("durationDays", "A duração da suspensão em dias é obrigatória e deve ser um número.").isInt({ min: 1 })
], adminController.suspendUser);

/**
 * @swagger
 * /api/admin/users/{userId}/unsuspend:
 *   put:
 *     summary: Remover suspensão de um usuário
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário a ter a suspensão removida
 *     responses:
 *       200:
 *         description: Suspensão do usuário removida com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/users/:userId/unsuspend", protect, adminController.checkAdmin, adminController.unsuspendUser);

/**
 * @swagger
 * /api/admin/logs:
 *   get:
 *     summary: Obter logs do sistema com paginação e filtros
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Limite de logs por página
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *         description: Filtrar por nível de log (e.g., error, warn, info)
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filtrar por ID de usuário
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Data de início para filtro (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Data de fim para filtro (ISO 8601)
 *     responses:
 *       200:
 *         description: Lista de logs
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
 *                     logs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Log'
 *                     totalLogs:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     currentPage:
 *                       type: integer
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       500:
 *         description: Erro no servidor
 */
router.get("/logs", protect, adminController.checkAdmin, adminController.getLogs);

module.exports = router;


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
router.post("/clans", protect, adminController.checkAdmin, [
  check("name", "Nome do clã é obrigatório").notEmpty(),
  check("tag", "Tag do clã é obrigatória").notEmpty()
], adminController.createClan);

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
router.put("/clans/:clanName/assign-leader", protect, adminController.checkAdmin, [
  check("username", "Nome de usuário é obrigatório").notEmpty()
], adminController.assignClanLeaderByName);

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
router.put("/clans/:clanName/assign-member", protect, adminController.checkAdmin, [
  check("username", "Nome de usuário é obrigatório").notEmpty(),
  check("role", "Papel deve ser Member ou SubLeader").optional().isIn(["Member", "SubLeader"])
], adminController.assignClanMemberByName);



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
router.post(
  "/federations/create-with-territory",
  protect,
  adminController.checkAdmin,
  [
    check("name", "Nome da federação é obrigatório").notEmpty(),
    check("mapX", "A coordenada mapX é obrigatória e deve ser um número.").isNumeric(),
    check("mapY", "A coordenada mapY é obrigatória e deve ser um número.").isNumeric(),
    check("radius", "O raio (radius) é obrigatório e deve ser um número.").isNumeric(),
  ],
  adminController.createFederationWithTerritory
);

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
router.post(
  "/clans/create-with-territory",
  protect,
  adminController.checkAdmin,
  [
    check("name", "Nome do clã é obrigatório").notEmpty(),
    check("tag", "TAG do clã é obrigatória").notEmpty(),
    check("federationId", "ID da federação é obrigatório").notEmpty(),
    check("mapX", "A coordenada mapX é obrigatória e deve ser um número.").isNumeric(),
    check("mapY", "A coordenada mapY é obrigatória e deve ser um número.").isNumeric(),
    check("radius", "O raio (radius) é obrigatório e deve ser um número.").isNumeric(),
  ],
  adminController.createClanWithTerritory
);


