const express = require("express");
const router = express.Router();
const clanController = require("../controllers/clanController");
const { protect } = require("../middleware/authMiddleware");
const { check, validationResult } = require("express-validator");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Clan = require("../models/Clan");

/**
 * @swagger
 * tags:
 *   name: Clãs
 *   description: Gerenciamento de clãs e suas operações
 */

// Middleware para verificar se é ADM, líder do clã ou sub-líder do clã
const checkClanLeaderOrSubLeader = async (req, res, next) => {
  const clanId = req.params.id || req.body.clanId;
  if (!clanId) {
    return res.status(400).json({ msg: "ID do clã é obrigatório." });
  }

  try {
    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado." });
    }

    const isLeader = clan.leader && clan.leader.toString() === req.user.id;
    const isSubLeader = clan.subLeaders && clan.subLeaders.includes(req.user.id);
    const isAdmin = req.user.role === "ADM";

    if (isAdmin || isLeader || isSubLeader) {
      req.clan = clan;
      next();
    } else {
      res.status(403).json({ msg: "Acesso negado. Permissão insuficiente." });
    }
  } catch (error) {
    console.error("Erro no middleware checkClanLeaderOrSubLeader:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

// Middleware para verificar se é ADM
const checkAdmin = (req, res, next) => {
  if (req.user.role !== "ADM") {
    return res.status(403).json({ msg: "Acesso negado. Apenas administradores." });
  }
  next();
};

// Configuração do Multer para upload de imagens
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/clan_banners";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Apenas imagens são permitidas"));
  },
});

/**
 * @swagger
 * /api/clans:
 *   get:
 *     summary: Obter todos os clãs
 *     tags: [Clãs]
 *     security:
 *       - bearerAuth: []
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
 *                 clans:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado, token ausente ou inválido
 *       500:
 *         description: Erro no servidor
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
 *                 clan:
 *                   $ref: '#/components/schemas/Clan'
 *       400:
 *         description: Erro de validação ou clã já existe
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro no servidor
 */
router.get("/", protect, clanController.getClans);

router.post(
  "/",
  protect,
  [
    check("name", "Nome do clã é obrigatório").not().isEmpty(),
    check("tag", "Tag do clã é obrigatória e deve ter no máximo 5 caracteres").isLength({ max: 5 }),
  ],
  clanController.createClan
);

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
 *                 clan:
 *                   $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
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
 *               tag:
 *                 type: string
 *                 description: Nova tag do clã
 *               description:
 *                 type: string
 *                 description: Nova descrição do clã
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
 *                 clan:
 *                   $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar este clã
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
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
router.get("/:id", protect, clanController.getClanById);

router.put("/:id", protect, checkClanLeaderOrSubLeader, clanController.updateClan);

router.delete("/:id", protect, checkClanLeaderOrSubLeader, clanController.deleteClan);

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
 *         description: Proibido, usuário não tem permissão para atualizar o banner deste clã
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put(
  "/:id/banner",
  protect,
  checkClanLeaderOrSubLeader,
  upload.single("banner"),
  clanController.updateClanBanner
);

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
 *                 clan:
 *                   $ref: '#/components/schemas/Clan'
 *       400:
 *         description: Usuário já é membro do clã ou clã cheio
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/join", protect, clanController.joinClan);

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
 *                 clan:
 *                   $ref: '#/components/schemas/Clan'
 *       400:
 *         description: Usuário não é membro do clã
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/leave", protect, clanController.leaveClan);

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
 *                 clan:
 *                   $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para promover membros neste clã
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/promote/:userId", protect, checkClanLeaderOrSubLeader, clanController.promoteMember);

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
 *                 clan:
 *                   $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para rebaixar membros neste clã
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/demote/:userId", protect, checkClanLeaderOrSubLeader, clanController.demoteMember);

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
 *                 clan:
 *                   $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para transferir liderança deste clã
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/transfer/:userId", protect, checkClanLeaderOrSubLeader, clanController.transferLeadership);

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
 *                 clan:
 *                   $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para expulsar membros deste clã
 *       404:
 *         description: Clã ou usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/kick/:userId", protect, checkClanLeaderOrSubLeader, clanController.kickMember);

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
 *                 clan:
 *                   $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para adicionar aliados a este clã
 *       404:
 *         description: Clã ou clã aliado não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/ally/:allyId", protect, checkClanLeaderOrSubLeader, clanController.addAlly);

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
 *                 clan:
 *                   $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para remover aliados deste clã
 *       404:
 *         description: Clã ou clã aliado não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/remove-ally/:allyId", protect, checkClanLeaderOrSubLeader, clanController.removeAlly);

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
 *                 clan:
 *                   $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para adicionar inimigos a este clã
 *       404:
 *         description: Clã ou clã inimigo não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/enemy/:enemyId", protect, checkClanLeaderOrSubLeader, clanController.addEnemy);

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
 *                 clan:
 *                   $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para remover inimigos deste clã
 *       404:
 *         description: Clã ou clã inimigo não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/remove-enemy/:enemyId", protect, checkClanLeaderOrSubLeader, clanController.removeEnemy);

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
 *                     $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */
router.get("/federation/:federationId", protect, clanController.getClansByFederation);

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
 *                   $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para adicionar cargos neste clã
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.post("/:id/roles", protect, checkClanLeaderOrSubLeader, clanController.addCustomRole);

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
 *                   $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar cargos neste clã
 *       404:
 *         description: Clã ou cargo não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/roles/:roleName", protect, checkClanLeaderOrSubLeader, clanController.updateCustomRole);

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
 *                   $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para deletar cargos neste clã
 *       404:
 *         description: Clã ou cargo não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.delete("/:id/roles/:roleName", protect, checkClanLeaderOrSubLeader, clanController.deleteCustomRole);

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
 *                   $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atribuir cargos neste clã
 *       404:
 *         description: Clã, membro ou cargo não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/members/:userId/assign-role", protect, checkClanLeaderOrSubLeader, clanController.assignMemberRole);

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
 *                   $ref: '#/components/schemas/Clan'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para remover cargos neste clã
 *       404:
 *         description: Clã, membro ou cargo não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/members/:userId/remove-role", protect, checkClanLeaderOrSubLeader, clanController.removeMemberRole);

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     Clan:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único do clã
 *         name:
 *           type: string
 *           description: Nome do clã
 *         tag:
 *           type: string
 *           description: Tag do clã (máximo 5 caracteres)
 *         description:
 *           type: string
 *           description: Descrição do clã
 *           nullable: true
 *         leader:
 *           type: string
 *           description: ID do líder do clã
 *         subLeaders:
 *           type: array
 *           items:
 *             type: string
 *           description: IDs dos sub-líderes do clã
 *         members:
 *           type: array
 *           items:
 *             type: string
 *           description: IDs dos membros do clã
 *         federation:
 *           type: string
 *           description: ID da federação à qual o clã pertence
 *           nullable: true
 *         banner:
 *           type: string
 *           description: URL do banner do clã
 *           nullable: true
 *         allies:
 *           type: array
 *           items:
 *             type: string
 *           description: IDs dos clãs aliados
 *         enemies:
 *           type: array
 *           items:
 *             type: string
 *           description: IDs dos clãs inimigos
 *         customRoles:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *           description: Cargos personalizados do clã
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data de criação do clã
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização do clã
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d1a"
 *         name: "Clã dos Guerreiros"
 *         tag: "GWR"
 *         description: "Um clã de guerreiros destemidos."
 *         leader: "60d5ec49f8c7b7001c8e4d1b"
 *         subLeaders: ["60d5ec49f8c7b7001c8e4d1c"]
 *         members: ["60d5ec49f8c7b7001c8e4d1b", "60d5ec49f8c7b7001c8e4d1c", "60d5ec49f8c7b7001c8e4d1d"]
 *         federation: "60d5ec49f8c7b7001c8e4d1e"
 *         banner: "https://example.com/banner_guerreiros.png"
 *         allies: ["60d5ec49f8c7b7001c8e4d1f"]
 *         enemies: ["60d5ec49f8c7b7001c8e4d20"]
 *         customRoles: [{ name: "Recrutador", permissions: ["invite_member"] }]
 *         createdAt: "2023-10-27T10:00:00Z"
 *         updatedAt: "2023-10-27T10:00:00Z"
 */


