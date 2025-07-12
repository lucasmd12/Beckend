const uploadService = require('../services/uploadService');
const winston = require('winston');

// Logger específico para middleware de upload
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [UPLOAD-MIDDLEWARE-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
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

/**
 * Middleware para upload de avatar de usuário
 */
const uploadAvatar = (req, res, next) => {
  const upload = uploadService.single('avatar');
  
  upload(req, res, (err) => {
    if (err) {
      logger.error('Error uploading avatar:', err);
      return res.status(400).json({
        success: false,
        message: 'Erro no upload do avatar',
        error: err.message
      });
    }

    // Processar resultado do upload
    if (req.file) {
      req.uploadResult = uploadService.processUploadResult(req.file, req);
      logger.info('Avatar uploaded successfully', {
        userId: req.user?.id,
        filename: req.uploadResult?.filename
      });
    }

    next();
  });
};

/**
 * Middleware para upload de imagem de missão
 */
const uploadMissionImage = (req, res, next) => {
  const upload = uploadService.single('mission_image');
  
  upload(req, res, (err) => {
    if (err) {
      logger.error('Error uploading mission image:', err);
      return res.status(400).json({
        success: false,
        message: 'Erro no upload da imagem da missão',
        error: err.message
      });
    }

    if (req.file) {
      req.uploadResult = uploadService.processUploadResult(req.file, req);
      logger.info('Mission image uploaded successfully', {
        userId: req.user?.id,
        filename: req.uploadResult?.filename
      });
    }

    next();
  });
};

/**
 * Middleware para upload de imagem de clã
 */
const uploadClanImage = (req, res, next) => {
  const upload = uploadService.single('clan_image');
  
  upload(req, res, (err) => {
    if (err) {
      logger.error('Error uploading clan image:', err);
      return res.status(400).json({
        success: false,
        message: 'Erro no upload da imagem do clã',
        error: err.message
      });
    }

    if (req.file) {
      req.uploadResult = uploadService.processUploadResult(req.file, req);
      logger.info('Clan image uploaded successfully', {
        userId: req.user?.id,
        filename: req.uploadResult?.filename
      });
    }

    next();
  });
};

/**
 * Middleware para upload de imagem de federação
 */
const uploadFederationImage = (req, res, next) => {
  const upload = uploadService.single('federation_image');
  
  upload(req, res, (err) => {
    if (err) {
      logger.error('Error uploading federation image:', err);
      return res.status(400).json({
        success: false,
        message: 'Erro no upload da imagem da federação',
        error: err.message
      });
    }

    if (req.file) {
      req.uploadResult = uploadService.processUploadResult(req.file, req);
      logger.info('Federation image uploaded successfully', {
        userId: req.user?.id,
        filename: req.uploadResult?.filename
      });
    }

    next();
  });
};

/**
 * Middleware para múltiplos uploads
 */
const uploadMultiple = (fieldName, maxCount = 5) => {
  return (req, res, next) => {
    const upload = uploadService.array(fieldName, maxCount);
    
    upload(req, res, (err) => {
      if (err) {
        logger.error('Error uploading multiple files:', err);
        return res.status(400).json({
          success: false,
          message: 'Erro no upload dos arquivos',
          error: err.message
        });
      }

      // Processar resultados dos uploads
      if (req.files && req.files.length > 0) {
        req.uploadResults = req.files.map(file => uploadService.processUploadResult(file, req));
        logger.info('Multiple files uploaded successfully', {
          userId: req.user?.id,
          count: req.files.length
        });
      }

      next();
    });
  };
};

/**
 * Middleware para campos múltiplos de upload
 */
const uploadFields = (fields) => {
  return (req, res, next) => {
    const upload = uploadService.fields(fields);
    
    upload(req, res, (err) => {
      if (err) {
        logger.error('Error uploading field files:', err);
        return res.status(400).json({
          success: false,
          message: 'Erro no upload dos arquivos',
          error: err.message
        });
      }

      // Processar resultados dos uploads por campo
      if (req.files) {
        req.uploadResults = {};
        
        Object.keys(req.files).forEach(fieldName => {
          req.uploadResults[fieldName] = req.files[fieldName].map(file => 
            uploadService.processUploadResult(file, req)
          );
        });

        logger.info('Field files uploaded successfully', {
          userId: req.user?.id,
          fields: Object.keys(req.files)
        });
      }

      next();
    });
  };
};

/**
 * Middleware para validar se o upload é obrigatório
 */
const requireUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    logger.warn('Upload required but no file provided', {
      userId: req.user?.id,
      route: req.route?.path
    });
    
    return res.status(400).json({
      success: false,
      message: 'Arquivo é obrigatório para esta operação'
    });
  }
  
  next();
};

/**
 * Middleware para adicionar informações de upload à resposta
 */
const addUploadInfo = (req, res, next) => {
  // Adicionar informações de upload ao objeto de resposta
  if (req.uploadResult) {
    req.responseData = req.responseData || {};
    req.responseData.upload = req.uploadResult;
  }
  
  if (req.uploadResults) {
    req.responseData = req.responseData || {};
    req.responseData.uploads = req.uploadResults;
  }
  
  next();
};

/**
 * Middleware para limpeza em caso de erro
 */
const cleanupOnError = (err, req, res, next) => {
  if (err && req.file) {
    // Se houve erro e um arquivo foi enviado, tentar limpar
    if (req.file.filename && uploadService.deleteFile) {
      uploadService.deleteFile(req.file.filename)
        .then(result => {
          logger.info('Cleanup: File deleted after error', {
            filename: req.file.filename,
            result
          });
        })
        .catch(cleanupErr => {
          logger.error('Cleanup: Error deleting file after error', cleanupErr);
        });
    }
  }
  
  next(err);
};

/**
 * Middleware para validar tipo de arquivo específico
 */
const validateFileType = (allowedTypes) => {
  return (req, res, next) => {
    if (req.file) {
      const isAllowed = allowedTypes.some(type => {
        if (type.endsWith('/*')) {
          return req.file.mimetype.startsWith(type.slice(0, -1));
        }
        return req.file.mimetype === type;
      });
      
      if (!isAllowed) {
        logger.warn('File type not allowed', {
          mimetype: req.file.mimetype,
          allowedTypes,
          filename: req.file.originalname
        });
        
        return res.status(400).json({
          success: false,
          message: `Tipo de arquivo não permitido. Tipos aceitos: ${allowedTypes.join(', ')}`
        });
      }
    }
    
    next();
  };
};

/**
 * Middleware para validar tamanho de arquivo
 */
const validateFileSize = (maxSizeInMB) => {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  
  return (req, res, next) => {
    if (req.file && req.file.size > maxSizeInBytes) {
      logger.warn('File size exceeds limit', {
        size: req.file.size,
        maxSize: maxSizeInBytes,
        filename: req.file.originalname
      });
      
      return res.status(400).json({
        success: false,
        message: `Arquivo muito grande. Tamanho máximo: ${maxSizeInMB}MB`
      });
    }
    
    next();
  };
};

module.exports = {
  uploadAvatar,
  uploadMissionImage,
  uploadClanImage,
  uploadFederationImage,
  uploadMultiple,
  uploadFields,
  requireUpload,
  addUploadInfo,
  cleanupOnError,
  validateFileType,
  validateFileSize
};

