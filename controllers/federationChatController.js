const FederationChatMessage = require("../models/FederationChatMessage");
const Federation = require("../models/Federation");
const User = require("../models/User");

// Helper para checar permissão de líder/sublíder
async function isLeaderOrSubleader(userId, federationId) {
  const federation = await Federation.findById(federationId);
  if (!federation) return false;
  return (
    federation.lideres.map(id => id.toString()).includes(userId.toString()) ||
    federation.sublideres.map(id => id.toString()).includes(userId.toString())
  );
}

/**
 * @swagger
 * /api/federation-chat/{federationId}/message:
 *   post:
 *     summary: Enviar mensagem no chat da federação
 *     tags: [Chat de Federação]
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
 *                   $ref: "#/components/schemas/FederationChatMessage"
 *       400:
 *         description: Requisição inválida
 *       403:
 *         description: Permissão negada
 *       404:
 *         description: Usuário ou federação não encontrado
 *       500:
 *         description: Erro no servidor
 */
exports.sendMessage = async (req, res) => {
  try {
    const { federationId } = req.params;
    const { message, type, fileUrl } = req.body;
    const userId = req.user.id;

    if (!(await isLeaderOrSubleader(userId, federationId))) {
      return res.status(403).json({ error: "Permissão negada: só líderes e sublíderes podem enviar mensagens." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    let senderRole = "user";
    if (user.role === "ADM") {
      senderRole = "ADM";
    } else if (user.federation && user.federation.toString() === federationId) {
      const federation = await Federation.findById(federationId);
      if (federation) {
        if (federation.lideres.includes(userId)) {
          senderRole = "leader";
        } else if (federation.sublideres.includes(userId)) {
          senderRole = "sub_leader";
        }
      }
    }

    const chatMessage = new FederationChatMessage({
      federation: federationId,
      sender: userId,
      senderRole: senderRole,
      message,
      type: type || "text",
      fileUrl: fileUrl || null,
    });

    await chatMessage.save();

    await chatMessage.populate("sender", "username avatar");

    if (req.io) {
      req.io.to(`federation_${federationId}`).emit("federation_chat_message", {
        _id: chatMessage._id,
        sender: {
          _id: chatMessage.sender._id,
          username: chatMessage.sender.username,
          avatar: chatMessage.sender.avatar,
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
    console.error("Erro ao enviar mensagem na federação:", error);
    res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
};

/**
 * @swagger
 * /api/federation-chat/{federationId}/messages:
 *   get:
 *     summary: Obter mensagens do chat da federação
 *     tags: [Chat de Federação]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: federationId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação
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
 *         description: Lista de mensagens do chat da federação
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
 *                     $ref: "#/components/schemas/FederationChatMessage"
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Permissão negada
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro no servidor
 */
exports.getMessages = async (req, res) => {
  try {
    const { federationId } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 30 } = req.query;

    if (!(await isLeaderOrSubleader(userId, federationId))) {
      return res.status(403).json({ error: "Permissão negada: só líderes e sublíderes podem ver o chat." });
    }

    const messages = await FederationChatMessage.find({ federation: federationId })
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("sender", "username avatar");

    res.json({ success: true, messages });
  } catch (error) {
    console.error("Erro ao buscar mensagens da federação:", error);
    res.status(500).json({ error: "Erro ao buscar mensagens" });
  }
};


