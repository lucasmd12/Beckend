const Clan = require("../models/Clan");
const User = require("../models/User");

/**
 * Middleware para autorizar líderes de clã ou administradores
 */
const authorizeClanLeaderOrAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Administradores sempre têm acesso
    if (user.role === "ADM") {
      return next();
    }

    const clanId = req.params.clanId || req.params.id;
    if (!clanId) {
      return res.status(400).json({ message: "ID do clã é obrigatório" });
    }

    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({ message: "Clã não encontrado" });
    }

    // Verificar se é líder do clã
    if (clan.leader.toString() === user._id.toString()) {
      return next();
    }

    // Verificar se é sub-líder
    if (clan.subLeaders && clan.subLeaders.includes(user._id)) {
      return next();
    }

    return res.status(403).json({ message: "Acesso negado. Apenas líderes ou administradores podem realizar esta ação." });
  } catch (error) {
    console.error("Erro no middleware de autorização de clã:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};

/**
 * Middleware para autorizar membros de clã ou administradores
 */
const authorizeClanMember = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Administradores sempre têm acesso
    if (user.role === "ADM") {
      return next();
    }

    const clanId = req.params.clanId || req.params.id;
    if (!clanId) {
      return res.status(400).json({ message: "ID do clã é obrigatório" });
    }

    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({ message: "Clã não encontrado" });
    }

    // Verificar se é membro do clã
    if (clan.members.includes(user._id)) {
      return next();
    }

    return res.status(403).json({ message: "Acesso negado. Apenas membros do clã podem realizar esta ação." });
  } catch (error) {
    console.error("Erro no middleware de autorização de membro de clã:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};

/**
 * Middleware para verificar permissões de cargo customizado
 */
const authorizeClanCustomRole = (requiredPermissions = []) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      
      // Administradores sempre têm acesso
      if (user.role === "ADM") {
        return next();
      }

      const clanId = req.params.clanId || req.params.id;
      if (!clanId) {
        return res.status(400).json({ message: "ID do clã é obrigatório" });
      }

      const clan = await Clan.findById(clanId);
      if (!clan) {
        return res.status(404).json({ message: "Clã não encontrado" });
      }

      // Verificar se é líder (sempre tem todas as permissões)
      if (clan.leader.toString() === user._id.toString()) {
        return next();
      }

      // Verificar se é sub-líder (sempre tem todas as permissões)
      if (clan.subLeaders && clan.subLeaders.includes(user._id)) {
        return next();
      }

      // Verificar cargo customizado
      const memberData = clan.members.find(member => 
        member.user && member.user.toString() === user._id.toString()
      );

      if (!memberData || !memberData.customRole) {
        return res.status(403).json({ message: "Acesso negado. Cargo insuficiente." });
      }

      const customRole = clan.customRoles.find(role => 
        role.name === memberData.customRole
      );

      if (!customRole) {
        return res.status(403).json({ message: "Cargo customizado não encontrado." });
      }

      // Verificar se tem todas as permissões necessárias
      const hasAllPermissions = requiredPermissions.every(permission => 
        customRole.permissions.includes(permission)
      );

      if (!hasAllPermissions) {
        return res.status(403).json({ message: "Acesso negado. Permissões insuficientes." });
      }

      return next();
    } catch (error) {
      console.error("Erro no middleware de cargo customizado:", error);
      return res.status(500).json({ message: "Erro interno do servidor" });
    }
  };
};

module.exports = {
  authorizeClanLeaderOrAdmin,
  authorizeClanMember,
  authorizeClanCustomRole
};

