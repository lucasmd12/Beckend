const Federation = require("../models/Federation");

/**
 * Middleware para verificar se o usuário é:
 * - Líder da federação (federation.leader)
 * - OU tem papel global de ADM
 * 
 * Requisito: a federação deve ser passada como ID em req.params.id ou req.body.federationId
 */
const authorizeFederationLeaderOrADM = async (req, res, next) => {
  try {
    // Obtém o ID da federação da URL ou corpo da requisição
    const federationId = req.params.id || req.body.federationId;

    // Retorna erro se nenhum ID de federação foi fornecido
    if (!federationId) {
      return res.status(400).json({ msg: "ID da federação é obrigatório." });
    }

    // Busca a federação no banco de dados
    const federation = await Federation.findById(federationId);

    if (!federation) {
      return res.status(404).json({ msg: "Federação não encontrada." });
    }

    // Verifica se o usuário logado é líder da federação ou ADM global
    const isLeader = federation.leader && federation.leader.toString() === req.user.id;
    const isAdmin = req.user.role === "ADM";

    // Se for líder ou ADM, continua
    if (isAdmin || isLeader) {
      // Anexa a federação ao request para uso posterior no controller
      req.federation = federation;
      next();
    } else {
      // Acesso negado
      res.status(403).json({ msg: "Acesso negado. Permissão insuficiente." });
    }
  } catch (error) {
    // Tratamento de erro interno
    console.error("Erro no middleware authorizeFederationLeaderOrADM:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

module.exports = authorizeFederationLeaderOrADM;
