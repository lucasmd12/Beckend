const express = require("express");
const router = express.Router();
const federationController = require("../controllers/federationController");
const { protect } = require("../middleware/authMiddleware");
const authorizeFederationLeaderOrADM = require("../middleware/authorizeFederationLeaderOrADM");
const { check } = require("express-validator");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

/**
 * @swagger
 * tags:
 *   name: Federações
 *   description: Gerenciamento de federações e suas operações
 */

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/federation_banners";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)    );
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

// Middleware para ADM (usado só na criação)
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "ADM") return next();
  return res.status(403).json({ msg: "Acesso negado. Permissão de ADM necessária." });
};

/**
 * @swagger
 * /api/federations:
 *   get:
 *     summary: Obter todas as federações
 *     tags: [Federações]
 *     security:
 *       - bearerAuth: []
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
 *                 federations:
 *                   type: array
 *                   items:
 *                     $ref: \'#/components/schemas/Federation\'
 *       401:
 *         description: Não autorizado, token ausente ou inválido
 *       500:
 *         description: Erro no servidor
 */
router.get("/", protect, federationController.getFederations);

router.post(
  "/",
  [
    protect,
    isAdmin,
    [check("name", "Nome é obrigatório").not().isEmpty()],
  ],
  federationController.createFederation
);

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
 *   put:
 *     summary: Atualizar uma federação (líder ou ADM)
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
 *                 federation:
 *                   $ref: '#/components/schemas/Federation'
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para atualizar esta federação
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 *   delete:
 *     summary: Deletar uma federação (líder ou ADM)
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
router.get("/:id", protect, federationController.getFederationById);

router.put("/:id", protect, authorizeFederationLeaderOrADM, federationController.updateFederation);

router.delete("/:id", protect, authorizeFederationLeaderOrADM, federationController.deleteFederation);

/**
 * @swagger
 * /api/federations/{id}/leader:
 *   put:
 *     summary: Transferir liderança de uma federação
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
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newLeaderId
 *             properties:
 *               newLeaderId:
 *                 type: string
 *                 description: ID do usuário que se tornará o novo líder
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
 *                 federation:
 *                   $ref: '#/components/schemas/Federation'
 *       400:
 *         description: Erro de validação
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não tem permissão para transferir liderança
 *       404:
 *         description: Federação ou novo líder não encontrado
 *       500:
 *         description: Erro no servidor
 */
router.put("/:id/leader", protect, authorizeFederationLeaderOrADM, federationController.transferLeadership);

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
router.put(
  "/:id/banner",
  [protect, authorizeFederationLeaderOrADM, upload.single("banner")],
  federationController.updateFederationBanner
);

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
router.put("/:id/add-clan/:clanId", protect, authorizeFederationLeaderOrADM, federationController.addClanToFederation);

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
router.put("/:id/remove-clan/:clanId", protect, authorizeFederationLeaderOrADM, federationController.removeClanFromFederation);

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
router.put("/:id/promote-subleader/:userId", protect, authorizeFederationLeaderOrADM, federationController.promoteSubLeader);

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
router.put("/:id/demote-subleader/:userId", protect, authorizeFederationLeaderOrADM, federationController.demoteSubLeader);

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
router.put("/:id/add-ally/:allyId", protect, authorizeFederationLeaderOrADM, federationController.addAlly);

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
router.put("/:id/remove-ally/:allyId", protect, authorizeFederationLeaderOrADM, federationController.removeAlly);

module.exports = router;


