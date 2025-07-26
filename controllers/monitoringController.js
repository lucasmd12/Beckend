// src/controllers/monitoringController.js

const mongoose = require('mongoose');
const os = require('os');
const listEndpoints = require('express-list-endpoints');
const redis = require('redis'); // Usaremos o redis diretamente para o PING
const firebaseAdmin = require('firebase-admin');
// ✅ CORREÇÃO: A importação do redisConfig foi movida para o topo do arquivo.
const redisConfig = require("../config/redis"); // Importa a configuração do Redis

// Função auxiliar para verificar a saúde de um serviço
const checkServiceHealth = async (servicePromise, serviceName) => {
  try {
    const result = await servicePromise;
    if (result === 'PONG' || (typeof result === 'object' && result.ok === 1) || result === undefined) {
      return { service: serviceName, status: 'online', message: 'Conectado com sucesso.' };
    }
    return { service: serviceName, status: 'online', message: 'Resposta inesperada, mas conectado.' };
  } catch (error) {
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
    cpuUsage: `${(os.loadavg()[0] * 100 / os.cpus().length).toFixed(2)}%`,
    memory: {
      total: `${(totalMemory / 1024 / 1024).toFixed(2)} MB`,
      used: `${(usedMemory / 1024 / 1024).toFixed(2)} MB`,
      usagePercentage: `${((usedMemory / totalMemory) * 100).toFixed(2)}%`,
    },
    nodeVersion: process.version,
    // ✅ CORREÇÃO: A sintaxe quebrada foi removida daqui.
    platform: os.platform() 
  });
};

exports.getExternalServicesStatus = async (req, res) => {
  const redisClient = redisConfig.getClient();
  if (!redisClient || !redisConfig.isReady()) {
    return res.status(503).json({ service: 'Redis', status: 'offline', message: 'Redis client not initialized or not ready.' });
  }

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
  // Você tinha um .quit() aqui, mas geralmente o cliente Redis é persistente. Se precisar, pode adicionar de volta.
  // await redisClient.quit(); 
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

// ✅ SUA LÓGICA ORIGINAL FOI 100% PRESERVADA AQUI
exports.getApiRoutes = (req, res) => {
  try {
    if (!req.app) {
      return res.status(500).json({ 
        error: "Objeto app não disponível",
        message: "Não foi possível acessar as rotas da aplicação" 
      });
    }

    const routes = [];
    
    const extractRoutes = (stack, basePath = '') => {
      if (!stack) return;
      
      stack.forEach(layer => {
        if (layer.route) {
          const path = basePath + layer.route.path;
          const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
          routes.push({
            path: path,
            methods: methods
          });
        } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
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

    if (req.app._router && req.app._router.stack) {
      extractRoutes(req.app._router.stack);
    }

    if (routes.length === 0) {
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
    const axios = require('axios');
    const baseUrl = process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : `http://localhost:${process.env.PORT || 5000}`;
    const fullUrl = `${baseUrl}${path}`;

    const response = await axios({
      method: method.toLowerCase(),
      url: fullUrl,
      timeout: 5000,
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      },
    });

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
      statusCode = error.response.status;
      message = `Erro na resposta: ${statusCode} ${error.response.statusText}`;
      if (statusCode >= 500) {
        status = 'server_error';
      } else if (statusCode >= 400) {
        status = 'client_error';
      }
    } else if (error.request) {
      message = 'Nenhuma resposta recebida (servidor não respondeu ou timeout).';
    } else {
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
