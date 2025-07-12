const mongoose = require('mongoose');

const fcmTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  deviceId: {
    type: String,
    required: false,
    index: true
  },
  deviceType: {
    type: String,
    enum: ['android', 'ios', 'web'],
    default: 'android'
  },
  appVersion: {
    type: String,
    required: false
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsed: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Metadados do dispositivo
  deviceInfo: {
    model: String,
    osVersion: String,
    appBuild: String,
    language: String,
    timezone: String
  },
  // Configurações de notificação
  notificationSettings: {
    messages: {
      type: Boolean,
      default: true
    },
    calls: {
      type: Boolean,
      default: true
    },
    missions: {
      type: Boolean,
      default: true
    },
    promotions: {
      type: Boolean,
      default: true
    },
    system: {
      type: Boolean,
      default: true
    }
  },
  // Tópicos inscritos
  subscribedTopics: [{
    topic: String,
    subscribedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Estatísticas
  stats: {
    notificationsReceived: {
      type: Number,
      default: 0
    },
    lastNotificationAt: Date,
    registrationCount: {
      type: Number,
      default: 1
    }
  }
}, {
  timestamps: true,
  collection: 'fcm_tokens'
});

// Índices compostos para consultas eficientes
fcmTokenSchema.index({ userId: 1, isActive: 1 });
fcmTokenSchema.index({ userId: 1, deviceType: 1 });
fcmTokenSchema.index({ lastUsed: 1, isActive: 1 });
fcmTokenSchema.index({ 'notificationSettings.messages': 1, isActive: 1 });

// Middleware para atualizar updatedAt
fcmTokenSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Método para marcar token como usado
fcmTokenSchema.methods.markAsUsed = function() {
  this.lastUsed = new Date();
  this.isActive = true;
  return this.save();
};

// Método para desativar token
fcmTokenSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

// Método para inscrever em tópico
fcmTokenSchema.methods.subscribeToTopic = function(topic) {
  const existingSubscription = this.subscribedTopics.find(sub => sub.topic === topic);
  if (!existingSubscription) {
    this.subscribedTopics.push({
      topic,
      subscribedAt: new Date()
    });
  }
  return this.save();
};

// Método para desinscrever de tópico
fcmTokenSchema.methods.unsubscribeFromTopic = function(topic) {
  this.subscribedTopics = this.subscribedTopics.filter(sub => sub.topic !== topic);
  return this.save();
};

// Método para incrementar contador de notificações
fcmTokenSchema.methods.incrementNotificationCount = function() {
  this.stats.notificationsReceived += 1;
  this.stats.lastNotificationAt = new Date();
  return this.save();
};

// Método para verificar se pode receber notificação de um tipo
fcmTokenSchema.methods.canReceiveNotification = function(type) {
  if (!this.isActive) return false;
  
  switch (type) {
    case 'message':
      return this.notificationSettings.messages;
    case 'call':
      return this.notificationSettings.calls;
    case 'mission':
      return this.notificationSettings.missions;
    case 'promotion':
      return this.notificationSettings.promotions;
    case 'system':
      return this.notificationSettings.system;
    default:
      return true;
  }
};

// Métodos estáticos

// Encontrar tokens ativos de um usuário
fcmTokenSchema.statics.findActiveTokensByUserId = function(userId) {
  return this.find({ 
    userId, 
    isActive: true 
  }).sort({ lastUsed: -1 });
};

// Encontrar tokens ativos de múltiplos usuários
fcmTokenSchema.statics.findActiveTokensByUserIds = function(userIds) {
  return this.find({ 
    userId: { $in: userIds }, 
    isActive: true 
  }).sort({ lastUsed: -1 });
};

// Encontrar tokens por tipo de dispositivo
fcmTokenSchema.statics.findTokensByDeviceType = function(deviceType, isActive = true) {
  return this.find({ 
    deviceType, 
    isActive 
  }).sort({ lastUsed: -1 });
};

// Limpar tokens antigos (não usados há mais de X dias)
fcmTokenSchema.statics.cleanupOldTokens = function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.updateMany(
    { 
      lastUsed: { $lt: cutoffDate },
      isActive: true 
    },
    { 
      $set: { isActive: false } 
    }
  );
};

// Encontrar tokens duplicados
fcmTokenSchema.statics.findDuplicateTokens = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$token',
        count: { $sum: 1 },
        docs: { $push: '$_id' }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ]);
};

// Obter estatísticas gerais
fcmTokenSchema.statics.getGeneralStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalTokens: { $sum: 1 },
        activeTokens: {
          $sum: {
            $cond: [{ $eq: ['$isActive', true] }, 1, 0]
          }
        },
        androidTokens: {
          $sum: {
            $cond: [{ $eq: ['$deviceType', 'android'] }, 1, 0]
          }
        },
        iosTokens: {
          $sum: {
            $cond: [{ $eq: ['$deviceType', 'ios'] }, 1, 0]
          }
        },
        webTokens: {
          $sum: {
            $cond: [{ $eq: ['$deviceType', 'web'] }, 1, 0]
          }
        },
        totalNotificationsSent: { $sum: '$stats.notificationsReceived' },
        avgNotificationsPerToken: { $avg: '$stats.notificationsReceived' }
      }
    }
  ]);
};

// Encontrar tokens que podem receber um tipo específico de notificação
fcmTokenSchema.statics.findTokensForNotificationType = function(userIds, notificationType) {
  const query = {
    userId: { $in: userIds },
    isActive: true
  };

  // Adicionar filtro baseado no tipo de notificação
  switch (notificationType) {
    case 'message':
      query['notificationSettings.messages'] = true;
      break;
    case 'call':
      query['notificationSettings.calls'] = true;
      break;
    case 'mission':
      query['notificationSettings.missions'] = true;
      break;
    case 'promotion':
      query['notificationSettings.promotions'] = true;
      break;
    case 'system':
      query['notificationSettings.system'] = true;
      break;
  }

  return this.find(query).sort({ lastUsed: -1 });
};

// Registrar ou atualizar token
fcmTokenSchema.statics.registerToken = async function(userId, token, deviceInfo = {}) {
  try {
    // Verificar se o token já existe
    let existingToken = await this.findOne({ token });
    
    if (existingToken) {
      // Se o token existe mas para outro usuário, desativar o antigo
      if (existingToken.userId.toString() !== userId.toString()) {
        await existingToken.deactivate();
        
        // Criar novo registro para o usuário atual
        existingToken = new this({
          userId,
          token,
          deviceInfo,
          stats: { registrationCount: 1 }
        });
      } else {
        // Mesmo usuário, apenas atualizar
        existingToken.deviceInfo = { ...existingToken.deviceInfo, ...deviceInfo };
        existingToken.isActive = true;
        existingToken.lastUsed = new Date();
        existingToken.stats.registrationCount += 1;
      }
    } else {
      // Token novo
      existingToken = new this({
        userId,
        token,
        deviceInfo,
        stats: { registrationCount: 1 }
      });
    }

    await existingToken.save();
    return existingToken;
  } catch (error) {
    throw new Error(`Failed to register FCM token: ${error.message}`);
  }
};

const FCMToken = mongoose.model('FCMToken', fcmTokenSchema);

module.exports = FCMToken;

