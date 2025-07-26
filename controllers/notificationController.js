const notificationService = require("../services/notificationService");
const userService = require("../services/userService");
const clanService = require("../services/clanService");
const federationService = require("../services/federationService");
const winston = require("winston");

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "error" : "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [NOTIFICATION-CONTROLLER-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ""}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Enviar notificação global (apenas ADM)
exports.sendGlobalNotification = async (req, res) => {
  try {
    const { title, body, data } = req.body;
    await notificationService.sendGlobalNotification(title, body, data);
    res.status(200).json({ success: true, message: "Notificação global enviada com sucesso." });
  } catch (error) {
    logger.error("Erro ao enviar notificação global:", error);
    res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }
};

// Enviar notificação para um clã (Líder de Clã, ADM)
exports.sendClanNotification = async (req, res) => {
  try {
    const { clanId } = req.params;
    const { title, body, data } = req.body;
    // TODO: Adicionar verificação de permissão aqui ou no middleware
    await notificationService.sendClanNotification(clanId, title, body, data);
    res.status(200).json({ success: true, message: `Notificação enviada para o clã ${clanId} com sucesso.` });
  } catch (error) {
    logger.error("Erro ao enviar notificação para o clã:", error);
    res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }
};

// Enviar notificação para uma federação (Líder de Federação, ADM)
exports.sendFederationNotification = async (req, res) => {
  try {
    const { federationId } = req.params;
    const { title, body, data } = req.body;
    // TODO: Adicionar verificação de permissão aqui ou no middleware
    await notificationService.sendFederationNotification(federationId, title, body, data);
    res.status(200).json({ success: true, message: `Notificação enviada para a federação ${federationId} com sucesso.` });
  } catch (error) {
    logger.error("Erro ao enviar notificação para a federação:", error);
    res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }
};

// Enviar convite de clã (ADM, Líder de Federação, Líder de Clã)
exports.sendInviteNotification = async (req, res) => {
  try {
    const { targetUserId, clanId } = req.body;
    const senderUser = req.user; // Usuário que está enviando o convite

    // TODO: Adicionar verificação de permissão aqui ou no middleware
    // ADM pode convidar para qualquer clã
    // Líder de Federação pode convidar para clãs da sua federação
    // Líder de Clã pode convidar para o seu próprio clã

    const targetUser = await userService.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "Usuário alvo não encontrado." });
    }

    const clan = await clanService.getClanById(clanId);
    if (!clan) {
      return res.status(404).json({ success: false, message: "Clã não encontrado." });
    }

    await notificationService.sendInviteNotification(
      targetUser.fcmToken, 
      senderUser.username, 
      clan.name, 
      clanId,
      senderUser.id
    );

    res.status(200).json({ success: true, message: "Convite de clã enviado com sucesso." });
  } catch (error) {
    logger.error("Erro ao enviar convite de clã:", error);
    res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }
};


