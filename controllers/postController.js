const Post = require('../models/Post');

exports.getPosts = async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json({ success: true, data: posts });
  } catch (error) {
    console.error("Erro ao obter posts:", error);
    res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }
};

