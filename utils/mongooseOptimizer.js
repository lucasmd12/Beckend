const mongoose = require('mongoose');
const winston = require('winston');

// Logger específico para MongoDB
const mongoLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [MONGO-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
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

class MongooseOptimizer {
  constructor() {
    this.slowQueryThreshold = 100; // 100ms
    this.queryStats = {
      total: 0,
      slow: 0,
      errors: 0,
      averageTime: 0
    };
    this.slowQueries = [];
    this.maxSlowQueries = 50;
  }

  // Configurar otimizações globais do Mongoose
  configureGlobalOptimizations() {
    // ❌ serverSelectionTimeoutMS REMOVIDO — deve ser usado dentro de mongoose.connect()
    
    mongoose.set('bufferCommands', false); // Desabilitar buffer de comandos
    mongoose.set('strictQuery', true); // Melhor performance

    if (process.env.NODE_ENV === 'production') {
      mongoose.set('autoIndex', false);
    }

    mongoLogger.info('Mongoose global optimizations configured');
  }

  // Plugin para monitorar performance de queries
  createPerformancePlugin() {
    return function performancePlugin(schema) {
      schema.pre(/^find/, function() {
        this.startTime = Date.now();
      });

      schema.post(/^find/, function(result) {
        if (this.startTime) {
          const duration = Date.now() - this.startTime;
          
          this.constructor.optimizer.updateQueryStats(duration, this.getQuery(), this.op);
          
          if (duration > this.constructor.optimizer.slowQueryThreshold) {
            this.constructor.optimizer.logSlowQuery({
              model: this.model.modelName,
              operation: this.op,
              query: this.getQuery(),
              duration,
              timestamp: new Date().toISOString()
            });
          }
        }
      });

      schema.post(/^find/, function(error) {
        if (error) {
          this.constructor.optimizer.queryStats.errors++;
          mongoLogger.error(`Query error in ${this.model.modelName}:`, error.message);
        }
      });
    };
  }

  updateQueryStats(duration, query, operation) {
    this.queryStats.total++;
    
    if (duration > this.slowQueryThreshold) {
      this.queryStats.slow++;
    }

    this.queryStats.averageTime = 
      (this.queryStats.averageTime * (this.queryStats.total - 1) + duration) / this.queryStats.total;
  }

  logSlowQuery(queryInfo) {
    this.slowQueries.push(queryInfo);
    
    if (this.slowQueries.length > this.maxSlowQueries) {
      this.slowQueries.shift();
    }

    if (process.env.NODE_ENV !== 'production') {
      mongoLogger.warn(`Slow query detected: ${queryInfo.model}.${queryInfo.operation} - ${queryInfo.duration}ms`);
    }
  }

  optimizeQuery(model, operation, query = {}, options = {}) {
    const optimizedOptions = { ...options };

    if (['find', 'findOne', 'findById'].includes(operation) && !options.populate) {
      optimizedOptions.lean = true;
    }

    if (operation === 'find' && !options.limit) {
      optimizedOptions.limit = 50;
    }

    if (!options.select && this.getDefaultProjection(model)) {
      optimizedOptions.select = this.getDefaultProjection(model);
    }

    this.suggestIndexes(model, query);

    return optimizedOptions;
  }

  getDefaultProjection(modelName) {
    const projections = {
      'User': '-password -__v',
      'Message': '-__v',
      'Clan': '-__v',
      'Federation': '-__v',
      'VoiceChannel': '-password -__v'
    };

    return projections[modelName] || '-__v';
  }

  suggestIndexes(modelName, query) {
    const suggestions = [];
    const queryFields = Object.keys(query);
    
    if (queryFields.length > 0) {
      if (queryFields.length > 1) {
        suggestions.push(`Compound index suggested for ${modelName}: {${queryFields.join(', ')}}`);
      }
      
      queryFields.forEach(field => {
        if (typeof query[field] === 'string' && query[field].includes('$regex')) {
          suggestions.push(`Text index suggested for ${modelName}.${field}`);
        }
      });
    }

    if (process.env.NODE_ENV !== 'production' && suggestions.length > 0) {
      mongoLogger.info('Index suggestions:', suggestions);
    }
  }

  async executeOptimizedQuery(model, operation, query = {}, options = {}) {
    const startTime = Date.now();
    
    try {
      const optimizedOptions = this.optimizeQuery(model.modelName, operation, query, options);
      
      let result;
      switch (operation) {
        case 'find':
          result = await model.find(query, null, optimizedOptions);
          break;
        case 'findOne':
          result = await model.findOne(query, null, optimizedOptions);
          break;
        case 'findById':
          result = await model.findById(query, null, optimizedOptions);
          break;
        case 'countDocuments':
          result = await model.countDocuments(query);
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      const duration = Date.now() - startTime;
      this.updateQueryStats(duration, query, operation);

      return result;
    } catch (error) {
      this.queryStats.errors++;
      mongoLogger.error(`Optimized query error in ${model.modelName}:`, error.message);
      throw error;
    }
  }

  async createRecommendedIndexes() {
    try {
      const db = mongoose.connection.db;
      
      await db.collection('users').createIndex({ username: 1 }, { unique: true });
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('users').createIndex({ clan: 1 });
      await db.collection('users').createIndex({ federation: 1 });
      await db.collection('users').createIndex({ isOnline: 1 });

      await db.collection('messages').createIndex({ channel: 1, createdAt: -1 });
      await db.collection('messages').createIndex({ sender: 1 });

      await db.collection('clans').createIndex({ name: 1 }, { unique: true });
      await db.collection('clans').createIndex({ federation: 1 });
      await db.collection('clans').createIndex({ leader: 1 });

      await db.collection('federations').createIndex({ name: 1 }, { unique: true });
      await db.collection('federations').createIndex({ leader: 1 });

      await db.collection('voicechannels').createIndex({ name: 1 });
      await db.collection('voicechannels').createIndex({ clan: 1 });
      await db.collection('voicechannels').createIndex({ isActive: 1 });

      mongoLogger.info('Recommended indexes created successfully');
    } catch (error) {
      mongoLogger.error('Error creating recommended indexes:', error.message);
    }
  }

  getStats() {
    return {
      ...this.queryStats,
      slowQueryThreshold: this.slowQueryThreshold,
      recentSlowQueries: this.slowQueries.slice(-10),
      slowQueryRate: this.queryStats.total > 0 
        ? ((this.queryStats.slow / this.queryStats.total) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  clearStats() {
    this.queryStats = {
      total: 0,
      slow: 0,
      errors: 0,
      averageTime: 0
    };
    this.slowQueries = [];
  }

  async analyzeConnectionHealth() {
    try {
      const adminDb = mongoose.connection.db.admin();
      const serverStatus = await adminDb.serverStatus();
      
      return {
        connections: serverStatus.connections,
        opcounters: serverStatus.opcounters,
        mem: serverStatus.mem,
        uptime: serverStatus.uptime,
        version: serverStatus.version
      };
    } catch (error) {
      mongoLogger.error('Error analyzing connection health:', error.message);
      return null;
    }
  }
}

const mongooseOptimizer = new MongooseOptimizer();
mongooseOptimizer.configureGlobalOptimizations();
mongoose.Model.optimizer = mongooseOptimizer;

module.exports = mongooseOptimizer;

