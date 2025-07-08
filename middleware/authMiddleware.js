const jwt = require("jsonwebtoken");
const User = require("../models/User");
require("dotenv").config();

/**
 * Middleware de proteção de rotas privadas
 * - Lê token do cabeçalho Authorization
 * - Decodifica token
 * - Anexa `req.user` (sem senha)
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];

    try {
      // ✅ Decodifica e extrai ID e role
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // ✅ Busca o usuário no banco (caso ele tenha sido atualizado depois da geração do token)
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        console.warn(`[AUTH] Usuário do token não encontrado: ${decoded.id}`);
        return res.status(401).json({ msg: "Não autorizado. Usuário não encontrado." });
      }

      req.user = user; // ✅ Anexa o usuário à requisição
      return next();
    } catch (error) {
      console.error(`[AUTH] Erro ao verificar token: ${error.message}`);
      return res.status(401).json({ msg: "Token inválido ou expirado." });
    }
  }

  if (!token) {
    console.warn("[AUTH] Token ausente na requisição.");
    return res.status(401).json({ msg: "Não autorizado. Token ausente." });
  }
};

module.exports = { protect };
