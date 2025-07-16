# Roadmap de Implementação Frontend e Backend

Com base na análise detalhada e na idealização UI/UX do frontend, este documento descreve o que o frontend já possui, o que precisa ser completado ou criado, e as necessidades de novas rotas ou modificações no backend para suportar o novo plano.

## 1. Frontend: O que já existe e o que precisa ser feito

O frontend atual, desenvolvido em Flutter, já possui uma base sólida com diversas telas e serviços. No entanto, para atingir a visão do novo plano, serão necessárias modificações significativas e a criação de novos componentes.

### 1.1 Funcionalidades Existentes no Frontend (Base para o Novo Plano)

O frontend já possui as seguintes funcionalidades que servirão como base:

- **Autenticação:** Telas de login e registro (`login_screen.dart`, `register_screen.dart`) e serviços de autenticação (`auth_service.dart`).
- **Navegação Básica:** `home_screen.dart` e a estrutura de tabs (`tabs/`).
- **Gerenciamento de Clãs e Federações (Básico):** Telas como `clan_list_screen.dart`, `federation_list_screen.dart`, `clan_detail_screen.dart`, `federation_detail_screen.dart` e seus respectivos serviços (`clan_service.dart`, `federation_service.dart`).
- **Chats:** `global_chat_screen.dart`, `clan_text_chat_screen.dart`, `federation_text_chat_screen.dart` e `chat_service.dart`.
- **VoIP:** Telas de chamada (`call_page.dart`, `call_screen.dart`, `voice_call_screen.dart`), histórico (`call_history_page.dart`), contatos (`call_contacts_screen.dart`) e `voip_service.dart`.
- **QRR/Missões:** Telas de listagem (`qrr_list_screen.dart`), criação (`qrr_create_screen.dart`), edição (`qrr_edit_screen.dart`) e detalhes (`qrr_detail_screen.dart`), além do `qrr_service.dart`.
- **Painel Administrativo (Fragmentado):** Telas como `admin_dashboard_screen.dart`, `admin_manage_clans_screen.dart`, `admin_manage_federations_screen.dart`, `admin_manage_users_screen.dart`, `admin_manage_wars_screen.dart`, `admin_panel_screen.dart`.
- **Configurações:** `settings_screen.dart`.
- **Upload de Imagens (Básico):** `profile_picture_upload_screen.dart`, `clan_flag_upload_screen.dart` e `upload_service.dart`.

### 1.2 O que o Frontend precisa completar ou criar

Para implementar o novo plano, as seguintes áreas do frontend precisarão de atenção:

#### 1.2.1 Reorganização e Centralização do Painel Administrativo

- **Modificar:** `admin_panel_screen.dart` para ser o ponto de entrada centralizado.
- **Criar:**
    - `lib/screens/admin/admin_main_dashboard.dart`: Dashboard principal com estatísticas globais, gráficos e alertas.
    - `lib/screens/admin/admin_user_management.dart`: Interface completa para gestão de usuários (recrutamento, promoção/rebaixamento, transferência, banimento, suspensão, exclusão).
    - `lib/screens/admin/admin_organization_management.dart`: Interface para gestão hierárquica de federações e clãs (criação com líder opcional, transferência entre federações, gestão de tags/bandeiras).
    - `lib/screens/admin/admin_reports_screen.dart`: Para logs e relatórios.
    - `lib/screens/admin/admin_system_settings.dart`: Para configurações gerais do sistema.
- **Reutilizar/Adaptar:** As funcionalidades existentes nas telas `admin_manage_clans_screen.dart`, `admin_manage_federations_screen.dart`, `admin_manage_users_screen.dart`, `admin_manage_wars_screen.dart` deverão ser migradas e integradas nas novas telas de gestão centralizadas.

#### 1.2.2 Interface de Visualização Hierárquica (Explorar)

- **Criar:**
    - `lib/screens/exploration/federation_explorer_screen.dart`: Nova tela principal para visualização de todas as federações e seus clãs de forma interativa.
    - `lib/screens/exploration/federation_detail_enhanced.dart`: Versão aprimorada da tela de detalhes da federação com visualização dos clãs membros.
    - `lib/screens/exploration/clan_detail_enhanced.dart`: Versão aprimorada da tela de detalhes do clã com visualização dos membros e contexto da federação.
- **Modificar:** A tab `Início` ou criar uma nova tab `Explorar` na navegação inferior para acessar esta funcionalidade.

#### 1.2.3 Gestão de Bandeiras e Tags

- **Modificar:** `clan_flag_upload_screen.dart` para suportar o fluxo completo de upload, preview e aprovação de bandeiras.
- **Criar:**
    - `lib/screens/media/profile_picture_manager.dart`: Gerenciador de fotos de perfil com upload via galeria/câmera.
    - Componentes de UI para edição de tags de federação (provavelmente dentro de `admin_organization_management.dart` ou `federation_leader_panel_screen.dart`).
- **Integrar:** Exibição consistente de bandeiras de clãs e tags de federações em `OrganizationBadge` e `UserAvatarWithContext` (novos widgets).

#### 1.2.4 Chat Contextual

- **Modificar:** `global_chat_screen.dart`, `clan_text_chat_screen.dart`, `federation_text_chat_screen.dart` para serem unificados em uma única tela `lib/screens/chat/contextual_chat_screen.dart`.
- **Criar:** Um seletor de contexto (`context_selector.dart`) dentro da tela de chat para alternar entre Global, Federação e Clã.

#### 1.2.5 VoIP Integrado

- **Modificar:** As telas de chamada existentes (`call_page.dart`, `call_screen.dart`, `voice_call_screen.dart`) para integrar melhor o contexto organizacional (ex: mostrar membros do clã/federação na chamada).
- **Criar:** `lib/screens/voip/contextual_voice_screen.dart` para gerenciar salas de voz permanentes por clã/federação.

#### 1.2.6 Configurações e Perfil Aprimorados

- **Modificar:** `settings_screen.dart` para:
    - Expandir a seção de perfil com upload de foto via galeria.
    - Mostrar informações organizacionais (federação e clã atuais, com TAG e bandeira).
    - Adicionar acesso direto ao novo painel ADM (se o usuário for ADM).
    - Implementar logout e exclusão de conta.

#### 1.2.7 Componentes Reutilizáveis

- **Criar:** Diversos novos widgets para suportar a nova UI/UX, conforme detalhado na Seção 5.3 do documento de análise (`frontend_analysis_and_design.md`), como `ContextAwareAppBar`, `OrganizationBadge`, `UserAvatarWithContext`, `UserActionSheet`, etc.

## 2. Backend: Novas Rotas e Modificações Necessárias

O backend já está bem robusto e muitas das funcionalidades do novo plano já são suportadas pelas APIs existentes. No entanto, algumas novas rotas e/ou modificações pontuais serão necessárias para otimizar a comunicação e suportar as novas interfaces.

### 2.1 Novas Rotas no Backend (Recomendadas)

Embora muitas funcionalidades possam ser implementadas usando as APIs existentes, as seguintes novas rotas seriam benéficas para otimizar o frontend e reduzir a complexidade:

- **`GET /api/admin/dashboard-stats`**: Uma rota consolidada para obter todas as estatísticas necessárias para o dashboard do ADM (usuários online, clãs, federações, chamadas ativas, etc.). Isso evitaria múltiplas chamadas de API do frontend.

- **`PUT /api/admin/users/{userId}/set-role`**: Uma rota específica para ADM alterar o `role` de um usuário (ADM, Líder, Sublíder, Usuário). Atualmente, a promoção de líder de clã é feita via rota de clã, mas uma rota genérica para `role` seria mais limpa para o painel ADM.

- **`POST /api/media/upload/profile-picture`**: Uma rota dedicada para upload de fotos de perfil, que pode lidar com redimensionamento e otimização específicos para avatares.

- **`POST /api/media/upload/clan-flag`**: Uma rota dedicada para upload de bandeiras de clãs, com validações e processamento específicos para bandeiras.

- **`GET /api/hierarchy/full`**: Uma rota para obter a estrutura completa de federações e clãs (e talvez seus membros) em uma única requisição, otimizando a tela de exploração hierárquica.

- **`DELETE /api/admin/users/{userId}`**: Rota para apagar contas de usuário existentes. (Verificar se já existe uma rota para isso, caso contrário, criar).

- **`PUT /api/admin/users/{userId}/ban` / `PUT /api/admin/users/{userId}/suspend`**: Rotas específicas para banir/suspender usuários, com lógica de duração e motivo. (Verificar se já existe uma rota para isso, caso contrário, criar).

### 2.2 Modificações no Backend Existente (Opcional, mas Recomendado)

- **Melhorar `GET /api/clans` e `GET /api/federations`**: Adicionar parâmetros de query para permitir a busca por clãs sem líder ou federações sem líder, se necessário para o painel ADM.

- **`POST /api/clans` e `POST /api/federations`**: Garantir que a criação de clãs/federações sem líder seja suportada (já implementado para clãs, verificar para federações).

- **WebSockets/Socket.IO**: Reforçar a emissão de eventos Socket.IO para todas as ações administrativas que afetam o estado global do aplicativo (ex: `userUpdated`, `clanUpdated`, `federationUpdated`, `userBanned`, `userSuspended`). Isso garantirá que o frontend possa reagir em tempo real a essas mudanças.

- **Populate de Dados**: Revisar os `populate` em rotas que retornam dados de clãs e federações para garantir que todas as informações necessárias (líder, sublíderes, membros, tags, bandeiras) sejam incluídas para o frontend exibir sem chamadas adicionais.

## 3. Próximos Passos Recomendados

1.  **Priorização:** Definir quais funcionalidades do frontend serão implementadas primeiro, com base na complexidade e impacto.
2.  **Desenvolvimento Frontend:** Iniciar a implementação das novas telas e componentes, focando na reorganização da UI/UX.
3.  **Desenvolvimento Backend:** Implementar as novas rotas e modificações necessárias no backend em paralelo com o desenvolvimento do frontend.
4.  **Testes de Integração:** Realizar testes rigorosos entre frontend e backend para garantir que todas as funcionalidades estejam operando conforme o esperado.

Este roadmap serve como um guia para a próxima fase do desenvolvimento, garantindo que o frontend e o backend evoluam de forma sincronizada para alcançar a visão do aplicativo FEDERACAOMAD.

