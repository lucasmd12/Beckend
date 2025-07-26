const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Role = require("../utils/roles");

// Middleware para verificar se o usuário tem uma role específica
exports.hasRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ success: false, message: "Acesso negado. Role de usuário não definida." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Acesso negado. Você não tem permissão para realizar esta ação." });
    }
    next();
  };
};

// Middleware para verificar se o usuário é líder de clã ou ADM
exports.isClanLeaderOrAdmin = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(403).json({ success: false, message: "Acesso negado. Role de usuário não definida." });
  }

  if (req.user.role === Role.admMaster || (req.user.clanRole === Role.leader && req.user.clanId === req.params.clanId)) {
    next();
  } else {
    res.status(403).json({ success: false, message: "Acesso negado. Você não é líder deste clã ou ADM." });
  }
};

// Middleware para verificar se o usuário é líder de federação ou ADM
exports.isFederationLeaderOrAdmin = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(403).json({ success: false, message: "Acesso negado. Role de usuário não definida." });
  }

  if (req.user.role === Role.admMaster || (req.user.federationRole === Role.leader && req.user.federationId === req.params.federationId)) {
    next();
  } else {
    res.status(403).json({ success: false, message: "Acesso negado. Você não é líder desta federação ou ADM." });
  }
};

// Middleware para verificar permissão de convite de clã
exports.canInviteToClan = async (req, res, next) => {
  const { targetUserId, clanId } = req.body;
  const senderUser = req.user;

  if (!senderUser || !senderUser.role) {
    return res.status(403).json({ success: false, message: "Acesso negado. Role de usuário não definida." });
  }

  // ADM Master pode convidar para qualquer clã
  if (senderUser.role === Role.admMaster) {
    return next();
  }

  // Líder de Federação pode convidar para clãs da sua federação
  if (senderUser.federationRole === Role.leader && senderUser.federationId) {
    const targetClan = await clanService.getClanById(clanId);
    if (targetClan && targetClan.federationId === senderUser.federationId) {
      return next();
    }
  }

  // Líder de Clã pode convidar para o seu próprio clã
  if (senderUser.clanRole === Role.leader && senderUser.clanId === clanId) {
    return next();
  }

  res.status(403).json({ success: false, message: "Acesso negado. Você não tem permissão para convidar para este clã." });
};


