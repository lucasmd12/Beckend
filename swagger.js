const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "FederacaoMad API",
      version: "1.0.0",
      description: "Documentação automática da API usando Swagger",
    },
  },
  apis: [
    "./routes/adminRoutes.js",
    "./routes/authRoutes.js",
    "./routes/channelRoutes.js",
    "./routes/clanMission.routes.js",
    "./routes/clanRoutes.js",
    "./routes/federationRoutes.js",
    "./routes/globalChannelRoutes.js",
    "./routes/globalChatRoutes.js",
    "./routes/inviteRoutes.js",
    "./routes/joinRequestRoutes.js",
    "./routes/qrrRoutes.js",
    "./routes/segmentedNotificationRoutes.js",
    "./routes/statsRoutes.js",
    "./routes/uploadRoutes.js",
    "./routes/userRoutes.js",
    "./routes/voiceChannelRoutes.js",
    "./routes/voipRoutes.js",
    "./routes/clanWarRoutes.js",
    "./controllers/ClanMissionController.js",
    "./controllers/authController.js",
    "./controllers/channelController.js",
    "./controllers/clanChatController.js",
    "./controllers/clanController.js",
    "./controllers/federationChatController.js",
    "./controllers/federationController.js",
    "./controllers/federationQRRController.js",
    "./controllers/globalChatController.js",
    "./controllers/inviteController.js",
    "./controllers/joinRequestController.js",
    "./controllers/qrrController.js",
    "./controllers/uploadController.js",
    "./controllers/voipController.js",
    "./swagger/schemas.js"
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerUi, swaggerSpec };


