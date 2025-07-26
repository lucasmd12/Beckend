const express = require("express");
const router = express.Router();
const monitoringController = require("../controllers/monitoringController");
const healthCheckController = require("../controllers/healthCheckController");

// Middleware para passar o objeto "app" para o controller
const passApp = (req, res, next) => {
  // Garantir que o app está disponível no req
  if (!req.app && router.app) {
    req.app = router.app;
  }
  next();
};

router.use(passApp);

router.get("/status", monitoringController.getServerStatus);
router.get("/services", monitoringController.getExternalServicesStatus);
router.get("/sockets", monitoringController.getSocketConnections);
router.get("/routes", monitoringController.getApiRoutes);

// Novas rotas de health check
router.post("/health-check/multiple", healthCheckController.checkMultipleRoutes);
router.post("/health-check/quick", healthCheckController.quickHealthCheck);
router.delete("/health-check/cache", healthCheckController.clearCache);
router.get("/health-check/cache-stats", healthCheckController.getCacheStats);

// Rota legacy para compatibilidade
router.post("/check-route-health", monitoringController.checkRouteHealth);

module.exports = (app) => {
  // Armazenar referência do app no router
  router.app = app;
  return router;
};


// Rotas para estatísticas de performance
router.get("/performance/stats", (req, res) => {
  const performanceMiddleware = require("../middleware/performanceMiddleware");
  const optimizedCacheService = require("../services/optimizedCacheService");
  const mongooseOptimizer = require("../utils/mongooseOptimizer");
  
  res.json({
    performance: performanceMiddleware.getStats(),
    cache: optimizedCacheService.getStats(),
    mongodb: mongooseOptimizer.getStats(),
    timestamp: new Date().toISOString()
  });
});

router.delete("/performance/stats", (req, res) => {
  const performanceMiddleware = require("../middleware/performanceMiddleware");
  const optimizedCacheService = require("../services/optimizedCacheService");
  const mongooseOptimizer = require("../utils/mongooseOptimizer");
  
  performanceMiddleware.clearStats();
  optimizedCacheService.clearStats();
  mongooseOptimizer.clearStats();
  
  res.json({
    message: "Performance statistics cleared successfully",
    timestamp: new Date().toISOString()
  });
});

