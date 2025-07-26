# Guia de Integração Frontend - Backend VoIP

Este guia detalha tudo que o frontend precisa para se comunicar com o backend estável.

## 1. Autenticação (JWT)

- **Login**: `POST /api/auth/login` com `username` e `password`.
  - **Resposta**: Retorna um `token` JWT.
- **Uso do Token**: Para todas as rotas protegidas, inclua o token no cabeçalho `Authorization`:
  ```
  Authorization: Bearer <seu_token_jwt>
  ```

## 2. Funcionalidades VoIP (Voz sobre IP)

- **Socket.IO**: O frontend deve se conectar ao servidor Socket.IO para receber eventos em tempo real.

- **Eventos Socket.IO para Escutar**:
  - `connect`: Confirma a conexão ao servidor.
  - `incomingCall`: Notifica sobre uma chamada recebida. O payload contém `caller`, `callType`, `roomName` e `jitsiToken`.
  - `callAccepted`: Notifica que a chamada foi aceita.
  - `callRejected`: Notifica que a chamada foi rejeitada.
  - `callEnded`: Notifica que a chamada foi encerrada.

- **Fluxo de Chamada**:
  1. **Iniciar Chamada**: `POST /api/voip/initiate-call` com `receiverId` e `callType` (`voice` ou `video`).
     - O backend emitirá um evento `incomingCall` para o destinatário.
  2. **Receber Chamada**: O frontend do destinatário escuta o evento `incomingCall` e exibe a interface de chamada.
  3. **Aceitar Chamada**: `POST /api/voip/accept-call` com o `callId` recebido no evento.
  4. **Rejeitar Chamada**: `POST /api/voip/reject-call` com o `callId`.
  5. **Encerrar Chamada**: `POST /api/voip/end-call` com o `callId`.

- **Histórico**: `GET /api/voip/call-history` para obter o histórico de chamadas do usuário.

## 3. Gestão de Clãs e Federações (ADM)

- **Criar Clã (ADM)**:
  - `POST /api/clans` com `name`, `tag`, `description`.
  - Para criar **sem líder**, não envie o campo `leaderId`.
  - Para criar **com líder**, envie `leaderId` com o ID do usuário.

- **Atribuir Usuário a Clã (ADM)**:
  - `PUT /api/admin/users/{userId}/assign-clan` com `clanId` no corpo da requisição.

- **Adicionar Clã a Federação (ADM)**:
  - `PUT /api/federations/{federationId}/add-clan/{clanId}`.

## 4. QRR e Guerras de Clãs

- **Criar Missão (QRR)**: `POST /api/qrrs` com `title`, `description`, `clanId`, `startTime`, `endTime`.
  - O frontend pode usar isso para criar missões de guerra, onde a descrição pode incluir detalhes sobre o inimigo e a bandeira a ser atacada.

- **Declarar Guerra**: `POST /api/clan-wars/declare` com `challengedClanId` e `rules`.

- **Eventos Socket.IO para Guerras**:
  - `warDeclared`: Notifica sobre uma nova declaração de guerra.
  - `warAccepted`: Notifica que um desafio de guerra foi aceito.
  - `warRejected`: Notifica que um desafio de guerra foi rejeitado.

## 5. Endpoints Importantes

- **Documentação Swagger**: `http://<backend_url>/api-docs` para ver todas as rotas, parâmetros e respostas em detalhes.
- **URL do Backend**: `https://beckend-ydd1.onrender.com` (conforme seu arquivo `.env`).

Este guia deve cobrir os pontos essenciais para a integração. Se tiver mais alguma dúvida, pode perguntar!

