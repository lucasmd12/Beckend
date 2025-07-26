const User = require("../models/User");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { validationResult } = require("express-validator");

// ✅ NOVO: Gera o token JWT com id e role
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// @desc    Cadastrar novo usuário (sem email)
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  try {
    let user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ msg: "Usuário já existe" });
    }

    user = new User({
      username,
      password,
    });

    await user.save();

    // ✅ Token agora inclui role
    const token = generateToken(user._id, user.role);
    res.status(201).json({
      _id: user._id,
      username: user.username,
      token,
      role: user.role,
    });
  } catch (err) {
    console.error("Erro ao registrar:", err.message);
    res.status(500).send("Erro no servidor");
  }
};

// @desc    Fazer login
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ msg: "Credenciais inválidas" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Credenciais inválidas" });
    }

    // Atualiza o lastSeen e marca como online
    user.lastSeen = new Date();
    user.online = true;
    await user.save();

    // ✅ Token agora inclui role
    const token = generateToken(user._id, user.role);

    res.json({
      _id: user._id,
      username: user.username,
      token,
      role: user.role,
      clan: user.clan,
      federation: user.federation
    });
  } catch (err) {
    console.error("Erro ao logar:", err.message);
    res.status(500).send("Erro no servidor");
  }
};

// @desc    Obter perfil do usuário logado
// @route   GET /api/auth/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findOneAndUpdate(
      { _id: userId },
      { $set: { lastSeen: new Date() } },
      {
        new: true,
        select: '-password'
      }
    )
      .populate('clan', 'name tag customRoles')
      .populate('federation', 'name tag')
      .lean();

    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    res.json(user);
  } catch (err) {
    console.error("Erro ao buscar perfil:", err.message);
    res.status(500).send("Erro no servidor");
  }
};
