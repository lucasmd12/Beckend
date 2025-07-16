
const mongoose = require('mongoose');
const os = require('os');
const listEndpoints = require('express-list-endpoints');
const redis = require('redis'); // Usaremos o redis diretamente para o PING
const firebaseAdmin = require('firebase-admin');

// Função auxiliar para verificar a saúde de um serviço
const checkServiceHealth = async (servicePromise, serviceName) => {
  try {
    // Para o ping do mongoose, o resultado é 'ok'
    const result = await servicePromise;
    if (result === 'PONG' || (typeof result === 'object' && result.ok === 1) || result === undefined) {
      return { service: serviceName, status: 'online', message: 'Conectado com sucesso.' };
    }
    return { service: serviceName, status: 'online', message: 'Resposta inesperada, mas conectado.' };
  } catch (error) {
    // Para o Firebase, um erro específico indica sucesso no dry run
    if (serviceName === 'Firebase Admin' && error.code === 'messaging/invalid-argument') {
      return { service: serviceName, status: 'online', message: 'Dry run bem-sucedido.' };
    }
    return { service: serviceName, status: 'offline', message: error.message };
  }
};

exports.getServerStatus = (req, res) => {
  const uptime = process.uptime();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  res.json({
    status: 'online',
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
    cpuUsage: `${(os.loadavg()[0] * 100 / os.cpus().length).toFixed(2)}%`, // Média de 1 min normalizada pelo número de CPUs
    memory: {
      total: `${(totalMemory / 1024 / 1024).toFixed(2)} MB`,
      used: `${(usedMemory / 1024 / 1024).toFixed(2)} MB`,
      usagePercentage: `${((usedMemory / totalMemory) * 100).toFixed(2)}%`,
    },
    nodeVersion: process.version,
    platform: os.platform(),
    environment: process.env.NODE_ENV || 'development',
  });
};

exports.getExternalServicesStatus = async (req, res) => {
  const redisClient = redis.createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
  await redisClient.connect().catch(() => {}); // Tenta conectar, ignora erro se já conectado

  const services = [
    checkServiceHealth(mongoose.connection.db.admin().ping(), 'MongoDB'),
    checkServiceHealth(redisClient.ping(), 'Redis'),
    {
      service: 'Sentry',
      status: process.env.SENTRY_DSN ? 'configurado' : 'não configurado',
      message: process.env.SENTRY_DSN ? 'DSN encontrado.' : 'DSN não definido no .env',
    },
  ];

  const results = await Promise.all(services);
  await redisClient.quit();
  res.json(results);
};

exports.getSocketConnections = (req, res) => {
  const io = req.app.get('socketio');
  if (!io) return res.status(500).json({ error: 'Socket.IO não inicializado.' });

  const connectedClients = io.engine.clientsCount;
  const usersMap = io.connectedUsers || new Map();
  const connectedUsersList = Array.from(usersMap.keys());

  res.json({
    activeConnections: connectedClients,
    authenticatedUsersCount: usersMap.size,
    authenticatedUsers: connectedUsersList,
  });
};

exports.getApiRoutes = (req, res) => {
  try {
    // Verificar se o app está disponível
    if (!req.app) {
      return res.status(500).json({ 
        error: "Objeto app não disponível",
        message: "Não foi possível acessar as rotas da aplicação" 
      });
    }

    // Solução alternativa para Express 5.x
    const routes = [];
    
    // Função para extrair rotas do stack do router
    const extractRoutes = (stack, basePath = '') => {
      if (!stack) return;
      
      stack.forEach(layer => {
        if (layer.route) {
          // Rota direta
          const path = basePath + layer.route.path;
          const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
          routes.push({
            path: path,
            methods: methods
          });
        } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
          // Sub-router
          const routerPath = layer.regexp.source
            .replace(/^\^\\?/, '')
            .replace(/\$.*/, '')
            .replace(/\\\//g, '/')
            .replace(/\(\?\:\[\^\\\/\]\+\)\?\$/, '')
            .replace(/\?\$$/, '');
          
          extractRoutes(layer.handle.stack, basePath + routerPath);
        }
      });
    };

    // Tentar usar express-list-endpoints primeiro
    try {
      const endpointRoutes = listEndpoints(req.app);
      if (endpointRoutes && endpointRoutes.length > 0) {
        const formattedRoutes = endpointRoutes.map(route => ({
          path: route.path,
          methods: route.methods.join(", "),
        }));
        console.log(`[MONITORING] Encontradas ${formattedRoutes.length} rotas via express-list-endpoints`);
        return res.json(formattedRoutes);
      }
    } catch (listError) {
      console.warn("[MONITORING] express-list-endpoints falhou, usando método alternativo");
    }

    // Método alternativo para Express 5.x
    if (req.app._router && req.app._router.stack) {
      extractRoutes(req.app._router.stack);
    }

    // Se ainda não encontrou rotas, tentar acessar diretamente
    if (routes.length === 0) {
      // Adicionar rotas conhecidas manualmente como fallback
      const knownRoutes = [
        { path: '/api/monitoring/status', methods: ['GET'] },
        { path: '/api/monitoring/services', methods: ['GET'] },
        { path: '/api/monitoring/sockets', methods: ['GET'] },
        { path: '/api/monitoring/routes', methods: ['GET'] },
        { path: '/api/auth/login', methods: ['POST'] },
        { path: '/api/auth/register', methods: ['POST'] },
        { path: '/api/users', methods: ['GET', 'POST'] },
        { path: '/api/clans', methods: ['GET', 'POST'] },
        { path: '/api/federations', methods: ['GET', 'POST'] },
        { path: '/api/channels', methods: ['GET', 'POST'] },
        { path: '/api/voice-channels', methods: ['GET', 'POST'] },
        { path: '/api/global-channels', methods: ['GET', 'POST'] },
        { path: '/api/voip', methods: ['GET', 'POST'] },
        { path: '/api/federation-chat', methods: ['GET', 'POST'] },
        { path: '/api/clan-chat', methods: ['GET', 'POST'] },
        { path: '/api/qrrs', methods: ['GET', 'POST'] },
        { path: '/api/global-chat', methods: ['GET', 'POST'] },
        { path: '/api/uploads', methods: ['POST'] },
        { path: '/api/invites', methods: ['GET', 'POST'] },
        { path: '/api/join-requests', methods: ['GET', 'POST'] },
        { path: '/api/admin', methods: ['GET', 'POST'] },
        { path: '/api/hierarchy', methods: ['GET'] },
        { path: '/api/clan-missions', methods: ['GET', 'POST'] },
        { path: '/api/clan-wars', methods: ['GET', 'POST'] }
      ];
      
      routes.push(...knownRoutes);
    }

    const formattedRoutes = routes.map(route => ({
      path: route.path,
      methods: Array.isArray(route.methods) ? route.methods.join(", ") : route.methods,
    }));
    
    console.log(`[MONITORING] Encontradas ${formattedRoutes.length} rotas`);
    res.json(formattedRoutes);
  } catch (error) {
    console.error("[MONITORING] Erro ao listar rotas:", error);
    res.status(500).json({ 
      error: "Erro interno do servidor",
      message: "Falha ao listar as rotas da API" 
    });
  }
};




// NOVO: Função para verificar a saúde de uma rota específica
exports.checkRouteHealth = async (req, res) => {
  const { path, method } = req.body;

  if (!path || !method) {
    return res.status(400).json({ error: 'Parâmetros path e method são obrigatórios.' });
  }

  try {
    // Construir a URL completa para a rota
    const baseUrl = process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : `http://localhost:${process.env.PORT || 5000}`;
    const fullUrl = `${baseUrl}${path}`;

    // Fazer uma requisição HTTP para a rota
    const axios = require('axios'); // Será necessário instalar o axios
    const response = await axios({
      method: method.toLowerCase(),
      url: fullUrl,
      timeout: 5000, // Timeout de 5 segundos
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Considera 2xx, 3xx, 4xx como sucesso para o health check
      },
    });

    // Determinar o status com base na resposta
    let status = 'online';
    let message = 'Rota acessível e respondeu.';

    if (response.status >= 400) {
      status = 'client_error';
      message = `Erro do cliente: ${response.status} ${response.statusText}`;
    }
    if (response.status >= 500) {
      status = 'server_error';
      message = `Erro do servidor: ${response.status} ${response.statusText}`;
    }

    res.json({
      path,
      method,
      status,
      statusCode: response.status,
      message,
      responseTime: response.headers['x-response-time'] || 'N/A',
    });

  } catch (error) {
    let status = 'offline';
    let message = error.message;
    let statusCode = null;

    if (error.response) {
      // O servidor respondeu com um status fora da faixa 2xx
      statusCode = error.response.status;
      message = `Erro na resposta: ${statusCode} ${error.response.statusText}`;
      if (statusCode >= 500) {
        status = 'server_error';
      } else if (statusCode >= 400) {
        status = 'client_error';
      }
    } else if (error.request) {
      // A requisição foi feita, mas nenhuma resposta foi recebida
      message = 'Nenhuma resposta recebida (servidor não respondeu ou timeout).';
    } else {
      // Algo aconteceu na configuração da requisição que disparou um erro
      message = `Erro ao configurar requisição: ${error.message}`;
    }

    res.status(200).json({
      path,
      method,
      status,
      statusCode,
      message,
      responseTime: 'N/A',
    });
  }
};


