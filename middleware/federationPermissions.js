const Federation = require("../models/Federation");
const User = require("../models/User");

/**
 * Middleware para autorizar líderes de federação ou administradores
 */
const authorizeFederationLeaderOrAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Administradores sempre têm acesso
    if (user.role === "ADM") {
      return next();
    }

    const federationId = req.params.federationId || req.params.id;
    if (!federationId) {
      return res.status(400).json({ message: "ID da federação é obrigatório" });
    }

    const federation = await Federation.findById(federationId);
    if (!federation) {
      return res.status(404).json({ message: "Federação não encontrada" });
    }

    // Verificar se é líder da federação
    if (federation.leader.toString() === user._id.toString()) {
      return next();
    }

    // Verificar se é sub-líder
    if (federation.subLeaders && federation.subLeaders.includes(user._id)) {
      return next();
    }

    return res.status(403).json({ message: "Acesso negado. Apenas líderes ou administradores podem realizar esta ação." });
  } catch (error) {
    console.error("Erro no middleware de autorização de federação:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};

/**
 * Middleware para autorizar membros de federação (através de clãs) ou administradores
 */
const authorizeFederationMember = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate("clan");
    
    // Administradores sempre têm acesso
    if (user.role === "ADM") {
      return next();
    }

    const federationId = req.params.federationId || req.params.id;
    if (!federationId) {
      return res.status(400).json({ message: "ID da federação é obrigatório" });
    }

    const federation = await Federation.findById(federationId);
    if (!federation) {
      return res.status(404).json({ message: "Federação não encontrada" });
    }

    // Verificar se o clã do usuário pertence à federação
    if (user.clan && federation.clans.includes(user.clan._id)) {
      return next();
    }

    return res.status(403).json({ message: "Acesso negado. Apenas membros da federação podem realizar esta ação." });
  } catch (error) {
    console.error("Erro no middleware de autorização de membro de federação:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};

/**
 * Middleware para autorizar líderes de clã dentro de uma federação
 */
const authorizeFederationClanLeader = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate("clan");
    
    // Administradores sempre têm acesso
    if (user.role === "ADM") {
      return next();
    }

    const federationId = req.params.federationId || req.params.id;
    if (!federationId) {
      return res.status(400).json({ message: "ID da federação é obrigatório" });
    }

    const federation = await Federation.findById(federationId);
    if (!federation) {
      return res.status(404).json({ message: "Federação não encontrada" });
    }

    // Verificar se é líder da federação
    if (federation.leader.toString() === user._id.toString()) {
      return next();
    }

    // Verificar se é sub-líder da federação
    if (federation.subLeaders && federation.subLeaders.includes(user._id)) {
      return next();
    }

    // Verificar se é líder de um clã da federação
    if (user.clan && 
        federation.clans.includes(user.clan._id) && 
        user.clan.leader.toString() === user._id.toString()) {
      return next();
    }

    return res.status(403).json({ message: "Acesso negado. Apenas líderes podem realizar esta ação." });
  } catch (error) {
    console.error("Erro no middleware de autorização de líder de clã da federação:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};

module.exports = {
  authorizeFederationLeaderOrAdmin,
  authorizeFederationMember,
  authorizeFederationClanLeader
};

