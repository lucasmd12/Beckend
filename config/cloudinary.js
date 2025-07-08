const { v2: cloudinary } = require('cloudinary');
const winston = require('winston');

// Logger específico para Cloudinary
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [CLOUDINARY-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
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

class CloudinaryConfig {
  constructor() {
    this.isConfigured = false;
    this.isEnabled = process.env.CLOUDINARY_ENABLED === 'true';
  }

  /**
   * Inicializa a configuração do Cloudinary
   */
  initialize() {
    try {
      if (!this.isEnabled) {
        logger.warn('Cloudinary is disabled via CLOUDINARY_ENABLED environment variable');
        return false;
      }

      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (!cloudName || !apiKey || !apiSecret) {
        logger.error('Missing Cloudinary configuration. Required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
        this.isEnabled = false;
        return false;
      }

      // Configurar Cloudinary
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true // Sempre usar HTTPS
      });

      this.isConfigured = true;
      logger.info('Cloudinary configured successfully', {
        cloudName,
        apiKey: apiKey.substring(0, 6) + '***' // Log parcial da API key por segurança
      });

      return true;
    } catch (error) {
      logger.error('Error configuring Cloudinary:', error);
      this.isEnabled = false;
      this.isConfigured = false;
      return false;
    }
  }

  /**
   * Verifica se o Cloudinary está disponível
   */
  isAvailable() {
    return this.isEnabled && this.isConfigured;
  }

  /**
   * Obtém a instância do Cloudinary
   */
  getInstance() {
    if (!this.isAvailable()) {
      throw new Error('Cloudinary is not available. Check configuration.');
    }
    return cloudinary;
  }

  /**
   * Testa a conexão com o Cloudinary
   */
  async testConnection() {
    try {
      if (!this.isAvailable()) {
        return { success: false, error: 'Cloudinary not configured' };
      }

      // Fazer uma requisição simples para testar a conexão
      const result = await cloudinary.api.ping();
      
      logger.info('Cloudinary connection test successful');
      return { success: true, result };
    } catch (error) {
      logger.error('Cloudinary connection test failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtém informações sobre o uso da conta
   */
  async getUsageInfo() {
    try {
      if (!this.isAvailable()) {
        return { success: false, error: 'Cloudinary not configured' };
      }

      const usage = await cloudinary.api.usage();
      
      return {
        success: true,
        usage: {
          plan: usage.plan,
          credits: usage.credits,
          objects: usage.objects,
          bandwidth: usage.bandwidth,
          storage: usage.storage,
          requests: usage.requests,
          transformations: usage.transformations
        }
      };
    } catch (error) {
      logger.error('Error getting Cloudinary usage info:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtém configurações de transformação padrão para diferentes tipos de imagem
   */
  getTransformationPresets() {
    return {
      avatar: {
        width: 200,
        height: 200,
        crop: 'fill',
        gravity: 'face',
        quality: 'auto:good',
        format: 'auto'
      },
      thumbnail: {
        width: 150,
        height: 150,
        crop: 'fill',
        quality: 'auto:good',
        format: 'auto'
      },
      medium: {
        width: 800,
        height: 600,
        crop: 'limit',
        quality: 'auto:good',
        format: 'auto'
      },
      large: {
        width: 1200,
        height: 900,
        crop: 'limit',
        quality: 'auto:good',
        format: 'auto'
      },
      mission_image: {
        width: 1000,
        height: 750,
        crop: 'limit',
        quality: 'auto:good',
        format: 'auto'
      }
    };
  }

  /**
   * Gera URL de imagem com transformações
   */
  generateImageUrl(publicId, transformations = {}) {
    try {
      if (!this.isAvailable()) {
        return null;
      }

      return cloudinary.url(publicId, {
        secure: true,
        ...transformations
      });
    } catch (error) {
      logger.error('Error generating image URL:', error);
      return null;
    }
  }

  /**
   * Gera múltiplas URLs com diferentes transformações
   */
  generateImageUrls(publicId, presetNames = ['thumbnail', 'medium']) {
    const presets = this.getTransformationPresets();
    const urls = {};

    presetNames.forEach(presetName => {
      if (presets[presetName]) {
        urls[presetName] = this.generateImageUrl(publicId, presets[presetName]);
      }
    });

    return urls;
  }

  /**
   * Obtém estatísticas de configuração
   */
  getStats() {
    return {
      isEnabled: this.isEnabled,
      isConfigured: this.isConfigured,
      isAvailable: this.isAvailable(),
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'not_configured'
    };
  }
}

// Instância singleton
const cloudinaryConfig = new CloudinaryConfig();

module.exports = cloudinaryConfig;

