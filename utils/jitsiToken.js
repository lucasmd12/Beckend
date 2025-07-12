const jwt = require("jsonwebtoken");

const JITSI_APP_ID = process.env.JITSI_APP_ID || "federacaomad";
const JITSI_APP_SECRET = process.env.JITSI_APP_SECRET || "your_jitsi_secret"; // MUDAR EM PRODUÇÃO
const JITSI_DOMAIN = process.env.JITSI_DOMAIN || "meet.jit.si"; // Ou seu domínio Jitsi customizado

const generateJitsiToken = (user, roomName, isModerator = false) => {
  const payload = {
    context: {
      user: {
        name: user.username,
        email: user.email || `${user.username}@${JITSI_APP_ID}.com`,
        avatar: user.avatar,
        moderator: isModerator,
      },
      features: {
        // Adicione recursos específicos se necessário
        // Por exemplo, para permitir gravação, streaming, etc.
        // "recording": true,
        // "livestreaming": true,
      },
    },
    aud: JITSI_APP_ID,
    iss: JITSI_APP_ID,
    sub: JITSI_DOMAIN,
    room: roomName, // Define a sala para a qual o token é válido
  };

  const options = {
    expiresIn: "24h", // Token expira em 24 horas
    jwtid: `${user.id}-${Date.now()}`, // ID único para o JWT
  };

  const token = jwt.sign(payload, JITSI_APP_SECRET, options);
  return token;
};

module.exports = generateJitsiToken;


