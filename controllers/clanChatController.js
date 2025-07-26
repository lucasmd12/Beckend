const ClanChatMessage = require("../models/ClanChatMessage");
const Clan = require("../models/Clan");
const User = require("../models/User");

// Helper para checar se o usuário é membro do clã (líder, sub ou membro)
async function isClanMember(userId, clanId) {
  const clan = await Clan.findById(clanId);
  if (!clan) return false;
  return (
    (clan.lideres || []).map(id => id.toString()).includes(userId.toString()) ||
    (clan.sublideres || []).map(id => id.toString()).includes(userId.toString()) ||
    (clan.membros || []).map(id => id.toString()).includes(userId.toString())
  );
}

/**
 * @swagger
 * /api/clan-chat/{clanId}/message:
 *   post:
 *     summary: Enviar mensagem no chat do clã
 *     tags: [Chat do Clã]
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
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Conteúdo da mensagem
 *               type:
 *                 type: string
 *                 description: "Tipo da mensagem (ex: text, image, file)"
 *                 enum: [text, image, file]
 *                 default: text
 *               fileUrl:
 *                 type: string
 *                 description: URL do arquivo, se o tipo for image ou file
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Mensagem enviada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 chatMessage:
 *                   $ref: "#/components/schemas/ClanChatMessage"
 *       400:
 *         description: Requisição inválida
 *       403:
 *         description: Permissão negada
 *       404:
 *         description: Usuário ou clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.sendMessage = async (req, res) => {
  try {
    const { clanId } = req.params;
    const { message, type, fileUrl } = req.body;
    const userId = req.user.id;

    if (!(await isClanMember(userId, clanId))) {
      return res.status(403).json({ error: "Permissão negada: só membros do clã podem enviar mensagens." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    let senderRole = "user";
    if (user.role === "ADM") {
      senderRole = "ADM";
    } else if (user.clan && user.clan.toString() === clanId) {
      const clan = await Clan.findById(clanId);
      if (clan) {
        if (clan.lideres.includes(userId)) {
          senderRole = "leader";
        } else if (clan.sublideres.includes(userId)) {
          senderRole = "sub_leader";
        }
      }
    }

    const chatMessage = new ClanChatMessage({
      clan: clanId,
      sender: userId,
      senderRole: senderRole,
      senderClanCustomRole: user.clanRole,
      message,
      type: type || "text",
      fileUrl: fileUrl || null,
    });

    await chatMessage.save();

    await chatMessage.populate("sender", "username avatar");

    if (req.io) {
      req.io.to(`clan_${clanId}`).emit("clan_chat_message", {
        _id: chatMessage._id,
        sender: {
          _id: chatMessage.sender._id,
          username: chatMessage.sender.username,
          avatar: chatMessage.sender.avatar,
        },
        senderRole: chatMessage.senderRole,
        senderClanCustomRole: chatMessage.senderClanCustomRole,
        message: chatMessage.message,
        type: chatMessage.type,
        fileUrl: chatMessage.fileUrl,
        createdAt: chatMessage.createdAt,
      });
    }

    res.json({ success: true, chatMessage });
  } catch (error) {
    console.error("Erro ao enviar mensagem no clã:", error);
    res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
};

/**
 * @swagger
 * /api/clan-chat/{clanId}/messages:
 *   get:
 *     summary: Obter mensagens do chat do clã
 *     tags: [Chat do Clã]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clanId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã
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
 *           default: 30
 *         description: Limite de mensagens por página
 *     responses:
 *       200:
 *         description: Lista de mensagens do chat do clã
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
 *                     $ref: "#/components/schemas/ClanChatMessage"
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Permissão negada
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.getMessages = async (req, res) => {
  try {
    const { clanId } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 30 } = req.query;

    if (!(await isClanMember(userId, clanId))) {
      return res.status(403).json({ error: "Permissão negada: só membros do clã podem ver o chat." });
    }

    const messages = await ClanChatMessage.find({ clan: clanId })
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("sender", "username avatar");

    res.json({ success: true, messages });
  } catch (error) {
    console.error("Erro ao buscar mensagens do clã:", error);
    res.status(500).json({ error: "Erro ao buscar mensagens" });
  }
};


