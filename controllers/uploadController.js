const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Clan = require('../models/Clan');
const Federation = require('../models/Federation');
const cloudinary = require('../config/cloudinary');

// Configuração do multer para upload local temporário
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../uploads/temp');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Apenas arquivos de imagem são permitidos!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    }
});

/**
 * @swagger
 * /api/upload/profile-picture:
 *   post:
 *     summary: Upload da foto de perfil do usuário
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo de imagem para a foto de perfil
 *     responses:
 *       200:
 *         description: Foto de perfil enviada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 avatar:
 *                   type: string
 *       400:
 *         description: Erro na requisição ou arquivo inválido
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
exports.uploadProfilePicture = [
    upload.single('profilePicture'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Nenhuma imagem foi enviada.' });
            }

            const userId = req.user.id;
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado.' });
            }

            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'profile_pictures',
                public_id: `user_${userId}_${Date.now()}`, // CORRIGIDO AQUI
                transformation: [
                    { width: 300, height: 300, crop: 'fill', gravity: 'face' },
                    { quality: 'auto', fetch_format: 'auto' }
                ]
            });

            if (user.avatar && user.avatar.includes('cloudinary')) {
                const publicId = user.avatar.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`profile_pictures/${publicId}`); // CORRIGIDO AQUI (se for um template literal)
            }

            user.avatar = result.secure_url;
            await user.save();

            fs.unlinkSync(req.file.path);

            res.json({
                success: true,
                message: 'Foto de perfil atualizada com sucesso!',
                avatar: result.secure_url
            });

        } catch (error) {
            console.error('Erro no upload da foto de perfil:', error);

            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    }
];

/**
 * @swagger
 * /api/upload/clan-flag/{clanId}:
 *   post:
 *     summary: Upload da bandeira do clã
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clanId
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
 *               clanFlag:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo de imagem para a bandeira do clã
 *     responses:
 *       200:
 *         description: Bandeira do clã enviada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 flag:
 *                   type: string
 *       400:
 *         description: Erro na requisição ou arquivo inválido
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não é líder do clã
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
exports.uploadClanFlag = [
    upload.single('clanFlag'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Nenhuma imagem foi enviada.' });
            }

            const { clanId } = req.params;
            const userId = req.user.id;

            const user = await User.findById(userId).populate('clan');
            const clan = await Clan.findById(clanId);

            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado.' });
            }

            if (!clan) {
                return res.status(404).json({ error: 'Clã não encontrado.' });
            }

            if (user.role !== 'ADM' && (user.clanRole !== 'leader' || user.clan._id.toString() !== clanId)) {
                return res.status(403).json({
                    error: 'Apenas líderes do clã podem alterar a bandeira.'
                });
            }

            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'clan_flags',
                public_id: `clan_${clanId}_${Date.now()}`, // CORRIGIDO AQUI
                transformation: [
                    { width: 500, height: 300, crop: 'fill' },
                    { quality: 'auto', fetch_format: 'auto' }
                ]
            });

            if (clan.flag && clan.flag.includes('cloudinary')) {
                const publicId = clan.flag.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`clan_flags/${publicId}`); // CORRIGIDO AQUI (se for um template literal)
            }

            clan.flag = result.secure_url;
            await clan.save();

            fs.unlinkSync(req.file.path);

            res.json({
                success: true,
                message: 'Bandeira do clã atualizada com sucesso!',
                flag: result.secure_url
            });

        } catch (error) {
            console.error('Erro no upload da bandeira do clã:', error);

            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    }
];

/**
 * @swagger
 * /api/upload/federation-tag/{federationId}:
 *   put:
 *     summary: Atualizar a TAG da federação
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: federationId
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
 *               - tag
 *             properties:
 *               tag:
 *                 type: string
 *                 description: Nova TAG da federação (máximo 10 caracteres)
 *     responses:
 *       200:
 *         description: TAG da federação atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 tag:
 *                   type: string
 *       400:
 *         description: "Erro na requisição (ex: TAG inválida ou já em uso)"
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Proibido, usuário não é ADM ou líder de clã da federação
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
exports.updateFederationTag = async (req, res) => {
    try {
        const { federationId } = req.params;
        const { tag } = req.body;
        const userId = req.user.id;

        if (!tag || tag.trim().length === 0) {
            return res.status(400).json({ error: 'TAG da federação é obrigatória.' });
        }

        if (tag.length > 10) {
            return res.status(400).json({ error: 'TAG deve ter no máximo 10 caracteres.' });
        }

        const user = await User.findById(userId).populate('clan');
        const federation = await Federation.findById(federationId);

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        if (!federation) {
            return res.status(404).json({ error: 'Federação não encontrada.' });
        }

        let hasPermission = false;

        if (user.role === 'ADM') {
            hasPermission = true;
        } else if (user.clan && user.clanRole === 'leader') {
            const clan = await Clan.findById(user.clan._id);
            if (clan && clan.federation.toString() === federationId) {
                hasPermission = true;
            }
        }

        if (!hasPermission) {
            return res.status(403).json({
                error: 'Apenas ADM ou líderes de clã da federação podem alterar a TAG.'
            });
        }

        const existingFederation = await Federation.findOne({
            tag: tag.toUpperCase(),
            _id: { $ne: federationId }
        });

        if (existingFederation) {
            return res.status(400).json({ error: 'Esta TAG já está sendo usada por outra federação.' });
        }

        federation.tag = tag.toUpperCase();
        await federation.save();

        res.json({
            success: true,
            message: 'TAG da federação atualizada com sucesso!',
            tag: federation.tag
        });

    } catch (error) {
        console.error('Erro ao atualizar TAG da federação:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};

/**
 * @swagger
 * /api/upload/user-identity/{userId}:
 *   get:
 *     summary: Obter informações de identidade visual do usuário
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Informações de identidade visual do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 identity:
 *                   type: object
 *                   properties:
 *                     username:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                     role:
 *                       type: string
 *                     clanRole:
 *                       type: string
 *                     clan:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         flag:
 *                           type: string
 *                         federation:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             name:
 *                               type: string
 *                             tag:
 *                               type: string
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
exports.getUserIdentity = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .populate({
                path: 'clan',
                populate: {
                    path: 'federation',
                    select: 'name tag'
                }
            })
            .select('username avatar clan clanRole role');

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        const identity = {
            username: user.username,
            avatar: user.avatar,
            role: user.role,
            clanRole: user.clanRole,
            clan: user.clan ? {
                id: user.clan._id,
                name: user.clan.name,
                flag: user.clan.flag,
                federation: user.clan.federation ? {
                    id: user.clan.federation._id,
                    name: user.clan.federation.name,
                    tag: user.clan.federation.tag
                } : null
            } : null
        };

        res.json({
            success: true,
            identity
        });

    } catch (error) {
        console.error('Erro ao obter identidade do usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};

/**
 * @swagger
 * /api/upload/clan-flags:
 *   get:
 *     summary: Listar todas as bandeiras de clãs
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de bandeiras de clãs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 clanFlags:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       flag:
 *                         type: string
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
exports.getAllClanFlags = async (req, res) => {
    try {
        const clans = await Clan.find({ flag: { $exists: true, $ne: null } })
            .select('name flag')
            .sort({ name: 1 });

        res.json({
            success: true,
            clanFlags: clans
        });

    } catch (error) {
        console.error('Erro ao listar bandeiras dos clãs:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};

/**
 * @swagger
 * /api/upload/federation-tags:
 *   get:
 *     summary: Listar todas as TAGs de federações
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de TAGs de federações
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 federationTags:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       tag:
 *                         type: string
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
exports.getAllFederationTags = async (req, res) => {
    try {
        const federations = await Federation.find({ tag: { $exists: true, $ne: null } })
            .select('name tag')
            .sort({ name: 1 });

        res.json({
            success: true,
            federationTags: federations
        });

    } catch (error) {
        console.error('Erro ao listar TAGs das federações:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};

// module.exports = exports; // Esta linha não é necessária se você estiver usando exports.nomeDaFuncao
