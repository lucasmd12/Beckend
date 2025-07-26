const GlobalChatMessage = require("../models/GlobalChatMessage");
const User = require("../models/User");

/**
 * @swagger
 * /api/global-chat/message:
 *   post:
 *     summary: Enviar mensagem no chat global
 *     tags: [Chat Global]
 *     security:
 *       - bearerAuth: []
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
 *                   $ref: "#/components/schemas/GlobalChatMessage"
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.sendMessage = async (req, res) => {
  try {
    const { message, type, fileUrl } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId)
      .populate("clan", "name tag")
      .populate("federation", "name tag");
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    let senderRole = user.clanRole || user.federationRole || user.role || "user";

    const chatMessage = new GlobalChatMessage({
      sender: userId,
      senderRole: senderRole,
      message,
      type: type || "text",
      fileUrl: fileUrl || null,
    });

    await chatMessage.save();

    // Popula o sender novamente para garantir que as informações de clã/federação estejam presentes
    await chatMessage.populate({
      path: "sender",
      select: "username avatar clan clanRole federation federationRole role",
      populate: [
        { path: "clan", select: "name tag" },
        { path: "federation", select: "name tag" },
      ],
    });

    if (req.io) {
      req.io.to(`global_chat`).emit("global_chat_message", {
        _id: chatMessage._id,
        sender: {
          _id: chatMessage.sender._id,
          username: chatMessage.sender.username,
          avatar: chatMessage.sender.avatar,
          clan: chatMessage.sender.clan ? { name: chatMessage.sender.clan.name, tag: chatMessage.sender.clan.tag } : null,
          clanRole: chatMessage.sender.clanRole,
          federation: chatMessage.sender.federation ? { name: chatMessage.sender.federation.name, tag: chatMessage.sender.federation.tag } : null,
          federationRole: chatMessage.sender.federationRole,
          role: chatMessage.sender.role,
        },
        senderRole: chatMessage.senderRole,
        message: chatMessage.message,
        type: chatMessage.type,
        fileUrl: chatMessage.fileUrl,
        createdAt: chatMessage.createdAt,
      });
    }

    res.json({ success: true, chatMessage });
  } catch (error) {
    console.error("Erro ao enviar mensagem no chat global:", error);
    res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
};

/**
 * @swagger
 * /api/global-chat/messages:
 *   get:
 *     summary: Obter mensagens do chat global
 *     tags: [Chat Global]
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
 *           default: 30
 *         description: Limite de mensagens por página
 *     responses:
 *       200:
 *         description: Lista de mensagens do chat global
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
 *                     $ref: "#/components/schemas/GlobalChatMessage"
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro no servidor
 */
exports.getMessages = async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;

    const messages = await GlobalChatMessage.find({})
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate({
        path: "sender",
        select: "username avatar clan clanRole federation federationRole role",
        populate: [
          { path: "clan", select: "name tag" },
          { path: "federation", select: "name tag" },
        ],
      });

    res.json({ success: true, messages });
  } catch (error) {
    console.error("Erro ao buscar mensagens do chat global:", error);
    res.status(500).json({ error: "Erro ao buscar mensagens" });
  }
};


