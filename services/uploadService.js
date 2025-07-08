const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinaryConfig = require('../config/cloudinary');
const winston = require('winston');
const path = require('path');

// Logger específico para upload
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [UPLOAD-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
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

class CloudinaryUploadService {
  constructor() {
    this.storage = null;
    this.upload = null;
    this.isInitialized = false;
  }

  /**
   * Inicializa o serviço de upload
   */
  initialize() {
    try {
      if (!cloudinaryConfig.isAvailable()) {
        logger.warn('Cloudinary not available, using local storage fallback');
        this.initializeLocalStorage();
        return;
      }

      const cloudinary = cloudinaryConfig.getInstance();

      // Configurar storage do Cloudinary
      this.storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: async (req, file) => {
          // Determinar pasta baseada no tipo de arquivo
          const folder = this.getFolderByFileType(file, req);
          
          // Gerar nome único para o arquivo
          const filename = this.generateFilename(file);
          
          return {
            folder: folder,
            public_id: filename,
            allowed_formats: this.getAllowedFormats(file),
            transformation: this.getTransformationByType(file, req)
          };
        }
      });

      // Configurar multer com Cloudinary
      this.upload = multer({
        storage: this.storage,
        limits: {
          fileSize: 10 * 1024 * 1024, // 10MB
          files: 5 // Máximo 5 arquivos por upload
        },
        fileFilter: this.fileFilter.bind(this)
      });

      this.isInitialized = true;
      logger.info('Cloudinary upload service initialized successfully');

    } catch (error) {
      logger.error('Error initializing Cloudinary upload service:', error);
      this.initializeLocalStorage();
    }
  }

  /**
   * Inicializa storage local como fallback
   */
  initializeLocalStorage() {
    const localStorage = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads');
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const filename = this.generateFilename(file);
        cb(null, filename + path.extname(file.originalname));
      }
    });

    this.upload = multer({
      storage: localStorage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 5
      },
      fileFilter: this.fileFilter.bind(this)
    });

    this.isInitialized = true;
    logger.info('Local storage upload service initialized as fallback');
  }

  /**
   * Determina a pasta baseada no tipo de arquivo e contexto
   */
  getFolderByFileType(file, req) {
    const route = req.route?.path || req.path || '';
    
    if (route.includes('avatar') || file.fieldname === 'avatar') {
      return 'federacao_mad/avatars';
    }
    
    if (route.includes('mission') || file.fieldname === 'mission_image') {
      return 'federacao_mad/missions';
    }
    
    if (route.includes('clan') || file.fieldname === 'clan_image') {
      return 'federacao_mad/clans';
    }
    
    if (route.includes('federation') || file.fieldname === 'federation_image') {
      return 'federacao_mad/federations';
    }
    
    // Pasta padrão
    return 'federacao_mad/general';
  }

  /**
   * Gera nome único para o arquivo
   */
  generateFilename(file) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const originalName = file.originalname.replace(/[^a-zA-Z0-9]/g, '_');
    
    return `${timestamp}_${random}_${originalName}`;
  }

  /**
   * Define formatos permitidos baseado no tipo de arquivo
   */
  getAllowedFormats(file) {
    if (file.mimetype.startsWith('image/')) {
      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'];
    }
    
    if (file.mimetype.startsWith('video/')) {
      return ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    }
    
    // Para outros tipos de arquivo
    return ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'];
  }

  /**
   * Define transformações baseadas no tipo de arquivo
   */
  getTransformationByType(file, req) {
    const route = req.route?.path || req.path || '';
    const presets = cloudinaryConfig.getTransformationPresets();
    
    if (!file.mimetype.startsWith('image/')) {
      return []; // Sem transformação para não-imagens
    }
    
    if (route.includes('avatar') || file.fieldname === 'avatar') {
      return [presets.avatar];
    }
    
    if (route.includes('mission') || file.fieldname === 'mission_image') {
      return [presets.mission_image];
    }
    
    // Transformação padrão para outras imagens
    return [presets.medium];
  }

  /**
   * Filtro de arquivos
   */
  fileFilter(req, file, cb) {
    try {
      // Verificar tipo MIME
      const allowedMimes = [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/tiff',
        'video/mp4',
        'video/avi',
        'video/mov',
        'video/wmv',
        'video/flv',
        'video/webm',
        'application/pdf'
      ];

      if (!allowedMimes.includes(file.mimetype)) {
        logger.warn(`File type not allowed: ${file.mimetype}`, { filename: file.originalname });
        return cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`), false);
      }

      // Verificar tamanho do nome do arquivo
      if (file.originalname.length > 255) {
        logger.warn(`Filename too long: ${file.originalname.length} characters`);
        return cb(new Error('Nome do arquivo muito longo'), false);
      }

      // Verificar caracteres especiais no nome
      const validFilename = /^[a-zA-Z0-9._\-\s]+$/.test(file.originalname);
      if (!validFilename) {
        logger.warn(`Invalid characters in filename: ${file.originalname}`);
        return cb(new Error('Nome do arquivo contém caracteres inválidos'), false);
      }

      cb(null, true);
    } catch (error) {
      logger.error('Error in file filter:', error);
      cb(error, false);
    }
  }

  /**
   * Middleware para upload único
   */
  single(fieldName) {
    if (!this.isInitialized) {
      this.initialize();
    }
    return this.upload.single(fieldName);
  }

  /**
   * Middleware para múltiplos uploads
   */
  array(fieldName, maxCount = 5) {
    if (!this.isInitialized) {
      this.initialize();
    }
    return this.upload.array(fieldName, maxCount);
  }

  /**
   * Middleware para campos múltiplos
   */
  fields(fields) {
    if (!this.isInitialized) {
      this.initialize();
    }
    return this.upload.fields(fields);
  }

  /**
   * Processa resultado do upload
   */
  processUploadResult(file, req) {
    try {
      if (!file) {
        return null;
      }

      const result = {
        filename: file.filename || file.originalname,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        uploadedAt: new Date()
      };

      if (cloudinaryConfig.isAvailable() && file.path) {
        // Upload para Cloudinary
        result.cloudinary = {
          publicId: file.filename,
          url: file.path,
          secureUrl: file.path,
          folder: file.folder || 'federacao_mad/general'
        };

        // Gerar URLs com diferentes transformações
        if (file.mimetype.startsWith('image/')) {
          result.urls = cloudinaryConfig.generateImageUrls(file.filename, ['thumbnail', 'medium', 'large']);
        }
      } else {
        // Upload local
        result.local = {
          path: file.path,
          url: `/uploads/${file.filename}`
        };
      }

      logger.info('File upload processed successfully', {
        filename: result.filename,
        size: result.size,
        type: result.mimetype
      });

      return result;
    } catch (error) {
      logger.error('Error processing upload result:', error);
      return null;
    }
  }

  /**
   * Remove arquivo do Cloudinary
   */
  async deleteFile(publicId) {
    try {
      if (!cloudinaryConfig.isAvailable()) {
        logger.warn('Cannot delete file: Cloudinary not available');
        return { success: false, error: 'Cloudinary not available' };
      }

      const cloudinary = cloudinaryConfig.getInstance();
      const result = await cloudinary.uploader.destroy(publicId);
      
      logger.info('File deleted from Cloudinary', { publicId, result: result.result });
      return { success: true, result };
    } catch (error) {
      logger.error('Error deleting file from Cloudinary:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtém informações sobre um arquivo
   */
  async getFileInfo(publicId) {
    try {
      if (!cloudinaryConfig.isAvailable()) {
        return { success: false, error: 'Cloudinary not available' };
      }

      const cloudinary = cloudinaryConfig.getInstance();
      const result = await cloudinary.api.resource(publicId);
      
      return { success: true, info: result };
    } catch (error) {
      logger.error('Error getting file info from Cloudinary:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Lista arquivos de uma pasta
   */
  async listFiles(folder = 'federacao_mad', maxResults = 50) {
    try {
      if (!cloudinaryConfig.isAvailable()) {
        return { success: false, error: 'Cloudinary not available' };
      }

      const cloudinary = cloudinaryConfig.getInstance();
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        max_results: maxResults
      });
      
      return { success: true, files: result.resources };
    } catch (error) {
      logger.error('Error listing files from Cloudinary:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtém estatísticas do serviço
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      cloudinaryAvailable: cloudinaryConfig.isAvailable(),
      maxFileSize: '10MB',
      maxFiles: 5,
      allowedTypes: ['image/*', 'video/*', 'application/pdf']
    };
  }
}

// Instância singleton
const uploadService = new CloudinaryUploadService();

module.exports = uploadService;

