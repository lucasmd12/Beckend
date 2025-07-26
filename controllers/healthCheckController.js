const axios = require('axios');

class HealthCheckController {
  constructor() {
    this.routeHealthCache = new Map(); // Cache para evitar requisições excessivas
    this.cacheTimeout = 30000; // 30 segundos de cache
  }

  // Função para verificar a saúde de múltiplas rotas
  async checkMultipleRoutes(req, res) {
    try {
      const { routes } = req.body;

      if (!routes || !Array.isArray(routes)) {
        return res.status(400).json({ 
          error: 'Parâmetro routes deve ser um array de objetos com path e method.' 
        });
      }

      const baseUrl = process.env.RENDER_EXTERNAL_HOSTNAME 
        ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` 
        : `http://localhost:${process.env.PORT || 5000}`;

      const healthChecks = await Promise.allSettled(
        routes.map(route => this.checkSingleRoute(baseUrl, route.path, route.methods))
      );

      const results = healthChecks.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            path: routes[index].path,
            method: routes[index].methods,
            status: 'error',
            message: result.reason.message || 'Erro desconhecido',
            statusCode: null,
            responseTime: 'N/A'
          };
        }
      });

      res.json({
        timestamp: new Date().toISOString(),
        totalRoutes: routes.length,
        results
      });

    } catch (error) {
      console.error('Erro no health check múltiplo:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: error.message 
      });
    }
  }

  // Função para verificar uma única rota
  async checkSingleRoute(baseUrl, path, methods) {
    const cacheKey = `${path}-${methods}`;
    const now = Date.now();

    // Verificar cache
    if (this.routeHealthCache.has(cacheKey)) {
      const cached = this.routeHealthCache.get(cacheKey);
      if (now - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const fullUrl = `${baseUrl}${path}`;
      const method = Array.isArray(methods) ? methods[0] : methods.split(',')[0].trim();
      
      const startTime = Date.now();
      
      // Configuração especial para diferentes tipos de rota
      let requestConfig = {
        method: method.toLowerCase(),
        url: fullUrl,
        timeout: 5000,
        validateStatus: function (status) {
          return status >= 200 && status < 600; // Aceitar qualquer resposta HTTP
        },
        headers: {
          'User-Agent': 'VoIP-Health-Check/1.0'
        }
      };

      // Para rotas que precisam de autenticação, adicionar headers básicos
      if (path.includes('/api/admin') || path.includes('/api/users')) {
        requestConfig.headers['Authorization'] = 'Bearer health-check-token';
      }

      // Para rotas POST, adicionar body básico se necessário
      if (method.toLowerCase() === 'post') {
        requestConfig.data = {};
        requestConfig.headers['Content-Type'] = 'application/json';
      }

      const response = await axios(requestConfig);
      const responseTime = Date.now() - startTime;

      let status = 'online';
      let message = 'Rota acessível e respondeu.';

      if (response.status >= 500) {
        status = 'server_error';
        message = `Erro do servidor: ${response.status} ${response.statusText}`;
      } else if (response.status >= 400) {
        status = 'client_error';
        message = `Erro do cliente: ${response.status} ${response.statusText}`;
      }

      const result = {
        path,
        method: methods,
        status,
        statusCode: response.status,
        message,
        responseTime: `${responseTime}ms`
      };

      // Armazenar no cache
      this.routeHealthCache.set(cacheKey, {
        timestamp: now,
        data: result
      });

      return result;

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
        message = 'Timeout ou servidor não respondeu.';
        status = 'timeout';
      } else {
        message = `Erro de configuração: ${error.message}`;
      }

      const result = {
        path,
        method: methods,
        status,
        statusCode,
        message,
        responseTime: 'N/A'
      };

      // Armazenar erro no cache por menos tempo
      this.routeHealthCache.set(cacheKey, {
        timestamp: now,
        data: result
      });

      return result;
    }
  }

  // Função para limpar o cache
  clearCache(req, res) {
    this.routeHealthCache.clear();
    res.json({ 
      message: 'Cache de health check limpo com sucesso.',
      timestamp: new Date().toISOString()
    });
  }

  // Função para obter estatísticas do cache
  getCacheStats(req, res) {
    const stats = {
      cacheSize: this.routeHealthCache.size,
      cacheTimeout: this.cacheTimeout,
      entries: Array.from(this.routeHealthCache.keys()),
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  }

  // Função para health check rápido (apenas ping)
  async quickHealthCheck(req, res) {
    try {
      const baseUrl = process.env.RENDER_EXTERNAL_HOSTNAME 
        ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` 
        : `http://localhost:${process.env.PORT || 5000}`;

      const startTime = Date.now();
      const response = await axios.get(`${baseUrl}/api/monitoring/status`, {
        timeout: 3000
      });
      const responseTime = Date.now() - startTime;

      res.json({
        status: 'online',
        responseTime: `${responseTime}ms`,
        statusCode: response.status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.json({
        status: 'offline',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Exportar instância singleton
const healthCheckController = new HealthCheckController();

module.exports = {
  checkMultipleRoutes: (req, res) => healthCheckController.checkMultipleRoutes(req, res),
  clearCache: (req, res) => healthCheckController.clearCache(req, res),
  getCacheStats: (req, res) => healthCheckController.getCacheStats(req, res),
  quickHealthCheck: (req, res) => healthCheckController.quickHealthCheck(req, res)
};

