const User = require("../models/User");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { validationResult } = require("express-validator");

// Gera o token JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
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

    const token = generateToken(user._id);
    res.status(201).json({
      _id: user._id,
      username: user.username,
      token: token,
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

    // Atualizar lastSeen e online status
    user.lastSeen = new Date();
    user.online = true;
    await user.save();

    const token = generateToken(user._id);
    res.json({
      _id: user._id,
      username: user.username,
      token: token,
      role: user.role, // Incluir o papel do usuário na resposta de login
      clan: user.clan, // Incluir informações do clã
      federation: user.federation // Incluir informações da federação
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
    const userId = req.user.id; // O ID do usuário vem do token JWT autenticado

    // Encontra o usuário, atualiza o lastSeen e retorna o documento atualizado
    // O 'new: true' garante que o documento retornado seja o atualizado
    // O 'select' especifica quais campos queremos retornar para o perfil
    const user = await User.findOneAndUpdate(
      { _id: userId },
      { $set: { lastSeen: new Date() } },
      {
        new: true, // Retorna o documento modificado em vez do original
        select: '-password' // Exclui o campo de senha da resposta
      }
    )
    .populate('clan', 'name tag customRoles') // Popula o clã com nome, tag e customRoles
    .populate('federation', 'name tag') // Popula a federação com nome e tag
    .lean(); // Usar .lean() para retornar um objeto JavaScript puro, mais rápido para APIs

    if (!user) {
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    res.json(user);
  } catch (err) {
    console.error("Erro ao buscar perfil:", err.message);
    res.status(500).send("Erro no servidor");
  }
};
