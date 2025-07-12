const User = require("../models/User");
const Clan = require("../models/Clan");
const Federation = require("../models/Federation");

// Middleware para verificar permissões de criação de canais
const checkChannelCreationPermission = async (req, res, next) => {
  try {
    const { channelType, entityId } = req.body;
    const userId = req.user.id;

    // Buscar informações do usuário
    const user = await User.findById(userId).populate('clan').populate('federation');
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // ADM pode criar canais em qualquer lugar
    if (user.role === "ADM") {
      return next();
    }

    switch (channelType) {
      case 'global':
        // Qualquer usuário pode criar canais globais
        return next();

      case 'federation':
        // Apenas líderes de clã podem criar canais na federação
        if (!user.clan) {
          return res.status(403).json({ 
            error: "Você precisa estar em um clã para criar canais na federação." 
          });
        }

        // Verificar se o usuário é líder do clã
        if (user.clanRole !== 'leader') {
          return res.status(403).json({ 
            error: "Apenas líderes de clã podem criar canais na federação." 
          });
        }

        // Verificar se o clã pertence à federação especificada
        const clan = await Clan.findById(user.clan._id);
        if (!clan || clan.federation.toString() !== entityId) {
          return res.status(403).json({ 
            error: "Seu clã não pertence a esta federação." 
          });
        }

        return next();

      case 'clan':
        // Apenas líderes e sub-líderes podem criar canais no clã
        if (!user.clan) {
          return res.status(403).json({ 
            error: "Você precisa estar em um clã para criar canais no clã." 
          });
        }

        // Verificar se o usuário é líder ou sub-líder
        if (!['leader', 'sub_leader'].includes(user.clanRole)) {
          return res.status(403).json({ 
            error: "Apenas líderes e sub-líderes podem criar canais no clã." 
          });
        }

        // Verificar se o clã especificado é o clã do usuário
        if (user.clan._id.toString() !== entityId) {
          return res.status(403).json({ 
            error: "Você só pode criar canais no seu próprio clã." 
          });
        }

        return next();

      default:
        return res.status(400).json({ 
          error: "Tipo de canal inválido. Use 'global', 'federation' ou 'clan'." 
        });
    }

  } catch (error) {
    console.error("Erro ao verificar permissões de criação de canal:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
};

// Middleware para verificar permissões de gerenciamento de canais (editar/deletar)
const checkChannelManagementPermission = async (req, res, next) => {
  try {
    const channelId = req.params.id;
    const userId = req.user.id;

    // Buscar informações do usuário
    const user = await User.findById(userId).populate('clan').populate('federation');
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // Buscar informações do canal
    const Channel = require("../models/Channel");
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Canal não encontrado." });
    }

    // ADM pode gerenciar qualquer canal
    if (user.role === "ADM") {
      return next();
    }

    // Proprietário do canal pode sempre gerenciar
    if (channel.owner.toString() === userId) {
      return next();
    }

    // Verificar permissões baseadas no tipo de canal
    switch (channel.channelType) {
      case 'global':
        // Para canais globais, apenas o proprietário ou ADM podem gerenciar
        return res.status(403).json({ 
          error: "Apenas o proprietário do canal ou ADM podem gerenciar este canal." 
        });

      case 'federation':
        // Para canais de federação, líderes de clã da mesma federação podem gerenciar
        if (!user.clan || user.clanRole !== 'leader') {
          return res.status(403).json({ 
            error: "Apenas líderes de clã podem gerenciar canais da federação." 
          });
        }

        const clan = await Clan.findById(user.clan._id);
        if (!clan || clan.federation.toString() !== channel.entityId) {
          return res.status(403).json({ 
            error: "Você só pode gerenciar canais da sua federação." 
          });
        }

        return next();

      case 'clan':
        // Para canais de clã, líderes e sub-líderes do mesmo clã podem gerenciar
        if (!user.clan || !['leader', 'sub_leader'].includes(user.clanRole)) {
          return res.status(403).json({ 
            error: "Apenas líderes e sub-líderes podem gerenciar canais do clã." 
          });
        }

        if (user.clan._id.toString() !== channel.entityId) {
          return res.status(403).json({ 
            error: "Você só pode gerenciar canais do seu próprio clã." 
          });
        }

        return next();

      default:
        return res.status(400).json({ 
          error: "Tipo de canal inválido." 
        });
    }

  } catch (error) {
    console.error("Erro ao verificar permissões de gerenciamento de canal:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
};

module.exports = {
  checkChannelCreationPermission,
  checkChannelManagementPermission
};

