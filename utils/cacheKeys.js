/**
 * Utilitário para gerar chaves de cache padronizadas
 * Garante consistência e facilita manutenção
 */

class CacheKeys {
  // Prefixos por categoria
  static PREFIXES = {
    USER: 'user',
    CLAN: 'clan',
    FEDERATION: 'federation',
    MISSION: 'mission',
    STATS: 'stats',
    SESSION: 'session',
    CHAT: 'chat',
    VOICE: 'voice',
    CONFIG: 'config'
  };

  // Separador padrão
  static SEPARATOR = ':';

  // Versão do cache (para invalidação global)
  static VERSION = 'v1';

  /**
   * Gera chave base com versão
   * @param {string} prefix - Prefixo da categoria
   * @param {string} identifier - Identificador único
   * @param {string} suffix - Sufixo opcional
   * @returns {string} Chave formatada
   */
  static generateKey(prefix, identifier, suffix = null) {
    const parts = [this.VERSION, prefix, identifier];
    if (suffix) parts.push(suffix);
    return parts.join(this.SEPARATOR);
  }

  // === USUÁRIOS ===
  static user(userId) {
    return this.generateKey(this.PREFIXES.USER, userId);
  }

  static userProfile(userId) {
    return this.generateKey(this.PREFIXES.USER, userId, 'profile');
  }

  static userPermissions(userId) {
    return this.generateKey(this.PREFIXES.USER, userId, 'permissions');
  }

  static userStats(userId) {
    return this.generateKey(this.PREFIXES.USER, userId, 'stats');
  }

  static userOnlineStatus(userId) {
    return this.generateKey(this.PREFIXES.USER, userId, 'online');
  }

  // === CLÃS ===
  static clan(clanId) {
    return this.generateKey(this.PREFIXES.CLAN, clanId);
  }

  static clanMembers(clanId) {
    return this.generateKey(this.PREFIXES.CLAN, clanId, 'members');
  }

  static clanList(federationId = 'all') {
    return this.generateKey(this.PREFIXES.CLAN, 'list', federationId);
  }

  static clanStats(clanId) {
    return this.generateKey(this.PREFIXES.CLAN, clanId, 'stats');
  }

  static clanMissions(clanId) {
    return this.generateKey(this.PREFIXES.CLAN, clanId, 'missions');
  }

  // === FEDERAÇÕES ===
  static federation(federationId) {
    return this.generateKey(this.PREFIXES.FEDERATION, federationId);
  }

  static federationConfig(federationId) {
    return this.generateKey(this.PREFIXES.FEDERATION, federationId, 'config');
  }

  static federationList() {
    return this.generateKey(this.PREFIXES.FEDERATION, 'list');
  }

  static federationMembers(federationId) {
    return this.generateKey(this.PREFIXES.FEDERATION, federationId, 'members');
  }

  static federationStats(federationId) {
    return this.generateKey(this.PREFIXES.FEDERATION, federationId, 'stats');
  }

  // === MISSÕES ===
  static mission(missionId) {
    return this.generateKey(this.PREFIXES.MISSION, missionId);
  }

  static missionList(clanId) {
    return this.generateKey(this.PREFIXES.MISSION, 'list', clanId);
  }

  static activeMissions() {
    return this.generateKey(this.PREFIXES.MISSION, 'active');
  }

  // === ESTATÍSTICAS ===
  static globalStats() {
    return this.generateKey(this.PREFIXES.STATS, 'global');
  }

  static onlineUsers() {
    return this.generateKey(this.PREFIXES.STATS, 'online_users');
  }

  static serverStats() {
    return this.generateKey(this.PREFIXES.STATS, 'server');
  }

  // === SESSÕES ===
  static session(sessionId) {
    return this.generateKey(this.PREFIXES.SESSION, sessionId);
  }

  static userSession(userId) {
    return this.generateKey(this.PREFIXES.SESSION, 'user', userId);
  }

  // === CHAT ===
  static chatHistory(channelId, page = 1) {
    return this.generateKey(this.PREFIXES.CHAT, channelId, `page_${page}`);
  }

  static chatOnlineUsers(channelId) {
    return this.generateKey(this.PREFIXES.CHAT, channelId, 'online');
  }

  // === VOZ ===
  static voiceRoom(roomId) {
    return this.generateKey(this.PREFIXES.VOICE, roomId);
  }

  static voiceParticipants(roomId) {
    return this.generateKey(this.PREFIXES.VOICE, roomId, 'participants');
  }

  static activeVoiceRooms() {
    return this.generateKey(this.PREFIXES.VOICE, 'active_rooms');
  }

  // === CONFIGURAÇÕES ===
  static appConfig() {
    return this.generateKey(this.PREFIXES.CONFIG, 'app');
  }

  static featureFlags() {
    return this.generateKey(this.PREFIXES.CONFIG, 'features');
  }

  // === UTILITÁRIOS ===

  /**
   * Gera padrão para buscar múltiplas chaves
   * @param {string} prefix - Prefixo da categoria
   * @param {string} pattern - Padrão de busca
   * @returns {string} Padrão para SCAN
   */
  static pattern(prefix, pattern = '*') {
    return `${this.VERSION}${this.SEPARATOR}${prefix}${this.SEPARATOR}${pattern}`;
  }

  /**
   * Extrai informações de uma chave
   * @param {string} key - Chave completa
   * @returns {object} Informações extraídas
   */
  static parseKey(key) {
    const parts = key.split(this.SEPARATOR);
    return {
      version: parts[0],
      prefix: parts[1],
      identifier: parts[2],
      suffix: parts[3] || null,
      full: key
    };
  }

  /**
   * Valida se uma chave está no formato correto
   * @param {string} key - Chave para validar
   * @returns {boolean} True se válida
   */
  static isValidKey(key) {
    if (!key || typeof key !== 'string') return false;
    
    const parts = key.split(this.SEPARATOR);
    if (parts.length < 3) return false;
    
    const [version, prefix] = parts;
    return version === this.VERSION && Object.values(this.PREFIXES).includes(prefix);
  }

  /**
   * Gera chave temporária com TTL específico
   * @param {string} prefix - Prefixo da categoria
   * @param {string} identifier - Identificador único
   * @param {number} ttl - TTL em segundos
   * @returns {string} Chave com indicador de TTL
   */
  static temporaryKey(prefix, identifier, ttl) {
    return this.generateKey(prefix, identifier, `temp_${ttl}`);
  }

  /**
   * Lista todos os prefixos disponíveis
   * @returns {string[]} Array de prefixos
   */
  static getAllPrefixes() {
    return Object.values(this.PREFIXES);
  }

  /**
   * Gera chave para lock distribuído
   * @param {string} resource - Recurso a ser bloqueado
   * @returns {string} Chave de lock
   */
  static lockKey(resource) {
    return this.generateKey('lock', resource);
  }
}

module.exports = CacheKeys;

