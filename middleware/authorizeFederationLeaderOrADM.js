const Federation = require("../models/Federation");

const authorizeFederationLeaderOrADM = async (req, res, next) => {
  try {
    const federationId = req.params.id || req.body.federationId;
    if (!federationId) {
      return res.status(400).json({ msg: "ID da federação é obrigatório." });
    }

    const federation = await Federation.findById(federationId);
    if (!federation) {
      return res.status(404).json({ msg: "Federação não encontrada." });
    }

    const isLeader = federation.leader && federation.leader.toString() === req.user.id;
    const isAdmin = req.user.role === "ADM";

    if (isAdmin || isLeader) {
      req.federation = federation; // Anexa a federação ao objeto de requisição
      next();
    } else {
      res.status(403).json({ msg: "Acesso negado. Permissão insuficiente." });
    }
  } catch (error) {
    console.error("Erro no middleware authorizeFederationLeaderOrADM:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
};

module.exports = authorizeFederationLeaderOrADM;


