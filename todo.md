# Problemas Identificados no Backend VoIP

## Problemas Críticos Encontrados:

### 1. Inconsistência entre Rotas e Controller
- [ ] **CRÍTICO**: As rotas em `voipRoutes.js` usam `/call/initiate`, `/call/accept`, etc.
- [ ] **CRÍTICO**: O controller `voipController.js` tem métodos `initiateCall`, `acceptCall`, etc.
- [ ] **PROBLEMA**: Há inconsistência entre os endpoints das rotas e os métodos do controller

### 2. Modelos Call vs CallHistory
- [ ] **PROBLEMA**: Existem dois modelos diferentes para chamadas:
  - `Call.js` - Modelo complexo para chamadas em grupo (global, clan, federation, private)
  - `CallHistory.js` - Modelo simples para histórico de chamadas 1x1
- [ ] **INCONSISTÊNCIA**: O controller usa ambos os modelos de forma confusa

### 3. Middleware VoIP Auth
- [ ] **VERIFICAR**: Existe referência a `voipAuth` middleware nas rotas, mas precisa verificar se existe

### 4. Socket.IO Integration
- [ ] **PROBLEMA**: O controller tenta acessar `req.io.connectedUsers` mas essa estrutura pode não estar disponível
- [ ] **VERIFICAR**: Integração entre Express e Socket.IO para notificações em tempo real

### 5. Jitsi Token Generation
- [ ] **VERIFICAR**: Existe referência a `generateJitsiToken` mas precisa verificar implementação

## Rotas VoIP Faltantes para App Android:

### Chamadas 1x1 (Básicas)
- [ ] **FALTANDO**: Rota para verificar status de chamada ativa
- [ ] **FALTANDO**: Rota para obter informações de uma chamada específica
- [ ] **FALTANDO**: Rota para listar chamadas ativas do usuário

### Chamadas em Grupo
- [ ] **FALTANDO**: Rota para criar sala de voz em grupo
- [ ] **FALTANDO**: Rota para entrar em sala de voz existente
- [ ] **FALTANDO**: Rota para sair de sala de voz
- [ ] **FALTANDO**: Rota para listar participantes de uma sala

### Configurações de Áudio/Vídeo
- [ ] **FALTANDO**: Rota para configurar preferências de áudio/vídeo
- [ ] **FALTANDO**: Rota para testar conectividade
- [ ] **FALTANDO**: Rota para obter configurações de qualidade

### Notificações Push
- [ ] **FALTANDO**: Rota para registrar token FCM para notificações de chamada
- [ ] **FALTANDO**: Rota para configurar preferências de notificação

### Estatísticas e Qualidade
- [ ] **FALTANDO**: Rota para reportar qualidade da chamada
- [ ] **FALTANDO**: Rota para obter estatísticas de uso

## Próximos Passos:
1. Corrigir inconsistências entre rotas e controller
2. Verificar e corrigir middlewares
3. Implementar rotas faltantes
4. Testar integração Socket.IO
5. Verificar geração de tokens Jitsi

