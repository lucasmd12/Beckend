const InstaClanPost = require("../models/InstaClanPost");
const Clan = require("../models/Clan");
const User = require("../models/User");

// @desc    Criar uma nova postagem no Insta Clã
// @route   POST /api/clans/:clanId/instaclan/posts
// @access  Private (Membro do Clã ou ADM)
exports.createInstaClanPost = async (req, res) => {
  try {
    const { clanId } = req.params;
    const { content, imageUrl } = req.body;
    const userId = req.user.id; // ID do usuário autenticado

    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // Verificar se o usuário é membro do clã ou ADM
    const user = await User.findById(userId);
    if (!user || (!clan.members.includes(userId) && user.role !== "ADM")) {
      return res.status(403).json({ msg: "Você não tem permissão para postar neste clã" });
    }

    const newPost = new InstaClanPost({
      clan: clanId,
      author: userId,
      content,
      imageUrl,
    });

    const post = await newPost.save();
    // Popula o autor para retornar os dados completos
    await post.populate("author", "username avatar");

    res.status(201).json(post);
  } catch (error) {
    console.error("Erro ao criar postagem no Insta Clã:", error.message);
    res.status(500).json({ msg: "Erro interno do servidor" });
  }
};

// @desc    Listar postagens do Insta Clã de um clã específico
// @route   GET /api/clans/:clanId/instaclan/posts
// @access  Private (Membro do Clã ou ADM)
exports.getInstaClanPosts = async (req, res) => {
  try {
    const { clanId } = req.params;
    const userId = req.user.id; // ID do usuário autenticado

    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    // Verificar se o usuário é membro do clã ou ADM
    const user = await User.findById(userId);
    if (!user || (!clan.members.includes(userId) && user.role !== "ADM")) {
      return res.status(403).json({ msg: "Você não tem permissão para ver as postagens deste clã" });
    }

    const posts = await InstaClanPost.find({ clan: clanId })
      .populate("author", "username avatar")
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    console.error("Erro ao buscar postagens do Insta Clã:", error.message);
    res.status(500).json({ msg: "Erro interno do servidor" });
  }
};

// @desc    Excluir uma postagem do Insta Clã
// @route   DELETE /api/clans/:clanId/instaclan/posts/:postId
// @access  Private (Autor da postagem, Líder do Clã, Sublíder do Clã ou ADM)
exports.deleteInstaClanPost = async (req, res) => {
  try {
    const { clanId, postId } = req.params;
    const userId = req.user.id; // ID do usuário autenticado

    const post = await InstaClanPost.findById(postId);
    if (!post) {
      return res.status(404).json({ msg: "Postagem não encontrada" });
    }

    if (post.clan.toString() !== clanId) {
      return res.status(400).json({ msg: "Postagem não pertence a este clã" });
    }

    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({ msg: "Clã não encontrado" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    // Verificar permissão para excluir: autor, líder, sublíder ou ADM
    const isAuthor = post.author.toString() === userId;
    const isClanLeader = clan.leader.toString() === userId;
    const isClanSubLeader = clan.subLeaders.includes(userId);
    const isAdmin = user.role === "ADM";

    if (!isAuthor && !isClanLeader && !isClanSubLeader && !isAdmin) {
      return res.status(403).json({ msg: "Você não tem permissão para excluir esta postagem" });
    }

    await post.deleteOne();

    res.json({ msg: "Postagem excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir postagem do Insta Clã:", error.message);
    res.status(500).json({ msg: "Erro interno do servidor" });
  }
};


