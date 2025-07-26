# Análise Completa e Idealização UI/UX - Frontend VoIP FEDERACAOMAD

## Sumário Executivo

Este documento apresenta uma análise detalhada do frontend atual do aplicativo VoIP FEDERACAOMAD, identificando funcionalidades existentes, lacunas em relação ao backend e propondo uma reorganização completa da UI/UX para criar uma experiência mais intuitiva, organizada e funcional. O objetivo é centralizar as funcionalidades administrativas, melhorar a navegação entre clãs e federações, e implementar todas as funcionalidades do backend de forma eficiente.

## 1. Análise do Estado Atual do Frontend

### 1.1 Estrutura Técnica Identificada

O projeto Flutter atual apresenta uma arquitetura bem estruturada com as seguintes características:

**Tecnologias e Dependências:**
- Flutter SDK 3.3.0+ com Dart
- Firebase completo (Core, Database, Messaging, Auth, Crashlytics)
- Jitsi Meet SDK para VoIP
- Socket.IO para comunicação em tempo real
- Provider para gerenciamento de estado
- HTTP para comunicação com backend
- Sentry para monitoramento de erros

**Estrutura de Diretórios:**
- `/lib/screens/` - 40+ telas implementadas
- `/lib/services/` - Serviços de comunicação com backend
- `/lib/providers/` - Gerenciamento de estado
- `/lib/models/` - Modelos de dados
- `/lib/widgets/` - Componentes reutilizáveis
- `/lib/utils/` - Utilitários e constantes

### 1.2 Telas Existentes Analisadas

**Telas Administrativas Identificadas:**
- `admin_dashboard_screen.dart` - Dashboard principal do ADM
- `admin_manage_clans_screen.dart` - Gerenciamento de clãs
- `admin_manage_federations_screen.dart` - Gerenciamento de federações
- `admin_manage_users_screen.dart` - Gerenciamento de usuários
- `admin_manage_wars_screen.dart` - Gerenciamento de guerras
- `admin_panel_screen.dart` - Painel administrativo

**Telas de Clãs e Federações:**
- `clan_detail_screen.dart` - Detalhes do clã
- `clan_leader_panel_screen.dart` - Painel do líder do clã
- `clan_list_screen.dart` - Lista de clãs
- `clan_management_screen.dart` - Gerenciamento do clã
- `clan_text_chat_screen.dart` - Chat do clã
- `federation_detail_screen.dart` - Detalhes da federação
- `federation_leader_panel_screen.dart` - Painel do líder da federação
- `federation_list_screen.dart` - Lista de federações
- `federation_text_chat_screen.dart` - Chat da federação

**Telas de Comunicação:**
- `call_page.dart` - Página de chamada
- `call_screen.dart` - Tela de chamada
- `voice_call_screen.dart` - Chamada de voz
- `call_history_page.dart` - Histórico de chamadas
- `call_contacts_screen.dart` - Contatos para chamada
- `global_chat_screen.dart` - Chat global

**Telas de Missões (QRR):**
- `qrr_create_screen.dart` - Criar missão
- `qrr_detail_screen.dart` - Detalhes da missão
- `qrr_edit_screen.dart` - Editar missão
- `qrr_list_screen.dart` - Lista de missões
- `qrr_participants_screen.dart` - Participantes da missão

### 1.3 Análise das Imagens Fornecidas

Com base nas imagens fornecidas, identifiquei o seguinte estado atual da interface:

**Tela Principal (Home) - ADM Master:**
- Perfil do usuário com avatar, nome e badge "ADM MASTER"
- Estatísticas: Tempo Online, Mensagens, Chamadas
- Seção "Ações Rápidas" com botões:
  - Criar Federação (roxo)
  - Gerenciar Federações (azul)
  - Gerenciar Clãs (laranja)
  - Promover Usuário (verde)
  - Fazer Chamada (verde)
- Seção "Estatísticas" com:
  - Membros Online
  - Canais Ativos
  - Missões
- Seção "Avisos Importantes"
- Navegação inferior: Início, Voz, Global, Missões, Config

**Modal de Criação de Federação:**
- Campos: Nome da Federação, Tag da Federação (Opcional)
- Botões: Cancelar, Criar

**Lista de Federações:**
- Cards com nome da federação, tag ("Sem tag" quando não definida)
- Ícones de ação: transferir liderança, deletar
- Botão flutuante "+" para adicionar

**Tela de Erro - Voz:**
- Mensagem: "Você não está em um clã para ver os canais"
- Botão "Tentar Novamente"

**Chat Global:**
- Interface de chat padrão
- Mensagem: "No messages here yet"
- Campo de entrada de texto com ícones de anexo e envio

**Missões QRR:**
- Abas: Ativas, Pendentes, Concluídas, Regras
- Estado vazio: "Nenhuma missão ativa"
- Botão flutuante "+" para criar missão

**Configurações:**
- Perfil do usuário
- Botão "Logout"

**Painel Administrativo (Última Imagem):**
- Tela em branco com título "Painel Administrativo"
- Texto: "Conteúdo do Painel ADM"




## 2. Problemas e Lacunas Identificadas

### 2.1 Problemas de Organização e UX

**Dispersão de Funcionalidades Administrativas:**
O maior problema identificado é a dispersão das funcionalidades administrativas em múltiplas telas sem uma hierarquia clara. Atualmente, as funções de ADM estão espalhadas entre diferentes telas e não há um painel centralizado que permita acesso rápido a todas as funcionalidades administrativas. Isso cria confusão na navegação e dificulta a eficiência do administrador.

**Falta de Contexto Visual para Hierarquias:**
O sistema atual não apresenta claramente a hierarquia entre federações e clãs. Usuários não conseguem visualizar facilmente quais clãs pertencem a quais federações, nem navegar intuitivamente entre essas estruturas organizacionais. A interface não reflete adequadamente a relação hierárquica federação > clã > membro.

**Inconsistência na Apresentação de Informações:**
As telas atuais apresentam informações de forma inconsistente. Algumas mostram tags, outras não; algumas têm bandeiras, outras não. Não há um padrão visual claro que permita aos usuários identificar rapidamente o tipo de organização (federação vs clã) e suas características distintivas.

**Navegação Fragmentada:**
A navegação entre diferentes contextos (global, federação, clã) não é fluida. Usuários perdem o contexto de onde estão e como voltar. Não há breadcrumbs ou indicadores visuais claros do contexto atual.

### 2.2 Funcionalidades Faltantes do Backend

**Gestão Completa de Usuários pelo ADM:**
- Recrutamento de membros com interface dedicada
- Criação de líderes e sublíderes com seleção visual
- Transferência de usuários entre clãs e federações
- Sistema de banimento e suspensão com interface intuitiva
- Exclusão de contas de usuário com confirmações de segurança

**Gestão Avançada de Organizações:**
- Criação de clãs sem líder inicial (funcionalidade já implementada no backend)
- Atribuição posterior de líderes a clãs órfãos
- Transferência de clãs inteiros entre federações
- Visualização hierárquica completa de federações e seus clãs

**Sistema de Bandeiras e Tags Visuais:**
- Upload e gerenciamento de bandeiras de clãs via galeria do dispositivo
- Criação e edição de tags de federações
- Visualização consistente de bandeiras e tags em todas as interfaces
- Sistema de aprovação de bandeiras pelo ADM

**Integração VoIP Completa:**
- Interface para chamadas de voz e vídeo integrada ao contexto do clã/federação
- Histórico de chamadas com contexto organizacional
- Salas de voz permanentes por clã/federação
- Sistema de permissões para chamadas

### 2.3 Problemas de Integração Backend-Frontend

**Desconexão entre Funcionalidades:**
Muitas funcionalidades implementadas no backend não têm interface correspondente no frontend, ou a interface existente não utiliza todas as capacidades do backend. Por exemplo, o sistema de criação de clãs sem líder está implementado no backend mas não há interface para isso.

**Falta de Feedback em Tempo Real:**
O sistema Socket.IO está configurado mas não é utilizado adequadamente para fornecer feedback em tempo real sobre mudanças organizacionais, como quando um usuário é promovido, transferido ou quando uma guerra é declarada.

**Inconsistência de Estados:**
Não há sincronização adequada entre diferentes telas quando dados são alterados. Por exemplo, se um clã é transferido para uma federação, outras telas não são atualizadas automaticamente.

## 3. Visão da Nova Arquitetura UI/UX

### 3.1 Conceito Central: Contexto Hierárquico

A nova arquitetura deve ser baseada no conceito de "contexto hierárquico", onde o usuário sempre sabe em que nível da organização está (Global > Federação > Clã) e pode navegar facilmente entre esses contextos. Cada contexto terá suas próprias funcionalidades, permissões e interfaces específicas.

**Estrutura Hierárquica Visual:**
```
🌍 Global (Todos os usuários)
├── 🏛️ Federação A [TAG_A]
│   ├── ⚔️ Clã 1 [🏴 Bandeira1]
│   ├── ⚔️ Clã 2 [🏴 Bandeira2]
│   └── ⚔️ Clã 3 [🏴 Bandeira3]
├── 🏛️ Federação B [TAG_B]
│   ├── ⚔️ Clã 4 [🏴 Bandeira4]
│   └── ⚔️ Clã 5 [🏴 Bandeira5]
└── 🏛️ Federação C [TAG_C]
    └── ⚔️ Clã 6 [🏴 Bandeira6]
```

### 3.2 Painel Administrativo Centralizado

O novo painel administrativo será o coração do sistema para usuários ADM, centralizando todas as funcionalidades em uma interface intuitiva e organizada.

**Estrutura do Painel ADM:**

**Dashboard Principal:**
- Visão geral do sistema com estatísticas em tempo real
- Gráficos de atividade (usuários online, chamadas ativas, missões em andamento)
- Alertas e notificações importantes
- Ações rápidas mais utilizadas

**Seção de Gestão de Usuários:**
- Lista completa de usuários com filtros avançados
- Interface de recrutamento com busca e convite
- Criação de líderes e sublíderes com drag-and-drop
- Sistema de banimento/suspensão com histórico
- Transferência de usuários entre organizações

**Seção de Gestão Organizacional:**
- Visualização hierárquica interativa de federações e clãs
- Criação de federações com seleção de líder opcional
- Criação de clãs com ou sem líder inicial
- Transferência de clãs entre federações
- Gestão de tags e bandeiras

**Seção de Monitoramento:**
- Logs de atividades em tempo real
- Histórico de ações administrativas
- Relatórios de uso e estatísticas
- Sistema de auditoria

### 3.3 Interface de Visualização Hierárquica

A nova interface principal mostrará todas as federações e clãs de forma organizada e visualmente atrativa, permitindo que todos os usuários vejam a estrutura completa do sistema.

**Tela Principal Reorganizada:**
- Mapa visual das federações com suas tags distintivas
- Cards expansíveis mostrando clãs dentro de cada federação
- Bandeiras dos clãs visíveis e clicáveis
- Indicadores de atividade (membros online, missões ativas)
- Botões de entrada para membros autorizados

**Sistema de Navegação Contextual:**
- Breadcrumbs sempre visíveis mostrando: Global > Federação > Clã
- Botão "Voltar ao Global" sempre acessível
- Indicadores visuais do contexto atual
- Transições suaves entre contextos

### 3.4 Gestão de Bandeiras e Tags

**Sistema de Bandeiras de Clãs:**
- Interface de upload integrada à galeria do dispositivo
- Preview em tempo real da bandeira
- Sistema de aprovação pelo líder do clã ou ADM
- Histórico de bandeiras anteriores
- Redimensionamento automático e otimização

**Sistema de Tags de Federações:**
- Editor de tags com validação em tempo real
- Preview da tag em diferentes contextos
- Sistema de reserva de tags (evitar duplicatas)
- Histórico de mudanças de tags

### 3.5 Configurações e Perfil Aprimorados

**Tela de Configurações Expandida:**
- Seção de perfil com upload de foto via galeria
- Informações organizacionais (federação e clã atuais)
- Configurações de notificações granulares
- Configurações de privacidade e segurança
- Histórico de atividades pessoais

**Exibição de Afiliações:**
- Nome do usuário sempre visível
- Tag da federação ao lado do nome
- Bandeira do clã como avatar secundário
- Indicadores de cargo (líder, sublíder, membro)
- Status online/offline em tempo real


## 4. Especificações Detalhadas de Implementação

### 4.1 Reorganização da Navegação Principal

**Nova Estrutura de Tabs:**
A navegação inferior será reorganizada para refletir melhor o fluxo de uso:

1. **🏠 Início** - Dashboard contextual baseado no usuário
2. **🌍 Explorar** - Visualização hierárquica de federações e clãs
3. **💬 Chat** - Sistema de chat contextual (global/federação/clã)
4. **📞 Chamadas** - VoIP integrado com contexto organizacional
5. **⚙️ Configurações** - Perfil, configurações e painel ADM (se aplicável)

**Dashboard Contextual (Início):**
- **Para ADM:** Painel administrativo com estatísticas globais e ações rápidas
- **Para Líderes de Federação:** Painel da federação com clãs subordinados
- **Para Líderes de Clã:** Painel do clã com membros e missões
- **Para Membros:** Painel pessoal com atividades do clã/federação

### 4.2 Painel Administrativo Detalhado

**Tela Principal do Painel ADM:**
```
┌─────────────────────────────────────────┐
│ 👑 PAINEL ADMINISTRATIVO                │
├─────────────────────────────────────────┤
│ 📊 ESTATÍSTICAS GLOBAIS                 │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│ │ 👥  │ │ 🏛️  │ │ ⚔️  │ │ 📞  │        │
│ │ 1.2K│ │  15 │ │  87 │ │  23 │        │
│ │Users│ │Feds │ │Clans│ │Calls│        │
│ └─────┘ └─────┘ └─────┘ └─────┘        │
├─────────────────────────────────────────┤
│ 🚀 AÇÕES RÁPIDAS                        │
│ ┌─────────────┐ ┌─────────────┐        │
│ │👥 Gerenciar │ │🏛️ Gerenciar │        │
│ │   Usuários  │ │ Federações  │        │
│ └─────────────┘ └─────────────┘        │
│ ┌─────────────┐ ┌─────────────┐        │
│ │⚔️ Gerenciar │ │📊 Relatórios│        │
│ │    Clãs     │ │ e Logs      │        │
│ └─────────────┘ └─────────────┘        │
├─────────────────────────────────────────┤
│ 🔔 ALERTAS RECENTES                     │
│ • Novo usuário registrado: @user123     │
│ • Guerra declarada: ClanA vs ClanB      │
│ • Federação criada: NOVA_FED            │
└─────────────────────────────────────────┘
```

**Gestão de Usuários:**
```
┌─────────────────────────────────────────┐
│ 👥 GESTÃO DE USUÁRIOS                   │
├─────────────────────────────────────────┤
│ 🔍 [Buscar usuários...]        [+Novo] │
├─────────────────────────────────────────┤
│ Filtros: [Todos▼] [Online▼] [Cargo▼]   │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 👤 idcloned          🟢 Online      │ │
│ │    ADM MASTER                       │ │
│ │    📧 Promover 🔄 Transferir 🚫 Ban │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 👤 user123           🔴 Offline     │ │
│ │    Líder - Federação ALPHA          │ │
│ │    📧 Promover 🔄 Transferir 🚫 Ban │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Gestão Organizacional:**
```
┌─────────────────────────────────────────┐
│ 🏛️ GESTÃO ORGANIZACIONAL                │
├─────────────────────────────────────────┤
│ 📊 Visão Hierárquica                    │
├─────────────────────────────────────────┤
│ 🏛️ FEDERAÇÃO ALPHA [ALPHA]              │
│ ├── ⚔️ Clã Warriors [🏴]                │
│ ├── ⚔️ Clã Legends [🏴]                 │
│ └── ⚔️ Clã Heroes [🏴]                  │
│                                         │
│ 🏛️ FEDERAÇÃO BETA [BETA]               │
│ ├── ⚔️ Clã Titans [🏴]                 │
│ └── ⚔️ Clã Phoenix [🏴]                │
│                                         │
│ 🏛️ FEDERAÇÃO GAMMA [GAMMA]             │
│ └── ⚔️ Clã Dragons [🏴]                │
├─────────────────────────────────────────┤
│ [+ Nova Federação] [+ Novo Clã]         │
└─────────────────────────────────────────┘
```

### 4.3 Tela de Exploração Hierárquica

**Interface Principal de Exploração:**
Esta será a tela mais importante para usuários regulares, mostrando toda a estrutura organizacional de forma visualmente atrativa.

```
┌─────────────────────────────────────────┐
│ 🌍 EXPLORAR FEDERAÇÕES                  │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 🏛️ FEDERAÇÃO ALPHA                  │ │
│ │ Tag: [ALPHA]    👥 245 membros      │ │
│ │ ┌─────┐ ┌─────┐ ┌─────┐            │ │
│ │ │⚔️🏴│ │⚔️🏴│ │⚔️🏴│            │ │
│ │ │WAR │ │LEG │ │HER │            │ │
│ │ │ 45 │ │ 67 │ │ 89 │            │ │
│ │ └─────┘ └─────┘ └─────┘            │ │
│ │ [📞 Entrar] [💬 Chat] [ℹ️ Info]     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🏛️ FEDERAÇÃO BETA                   │ │
│ │ Tag: [BETA]     👥 156 membros      │ │
│ │ ┌─────┐ ┌─────┐                    │ │
│ │ │⚔️🏴│ │⚔️🏴│                    │ │
│ │ │TIT │ │PHX │                    │ │
│ │ │ 78 │ │ 78 │                    │ │
│ │ └─────┘ └─────┘                    │ │
│ │ [📞 Entrar] [💬 Chat] [ℹ️ Info]     │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 4.4 Sistema de Chat Contextual

**Chat Hierárquico:**
O sistema de chat será reorganizado para refletir a hierarquia organizacional:

1. **Chat Global** - Todos os usuários do sistema
2. **Chat da Federação** - Apenas membros da federação
3. **Chat do Clã** - Apenas membros do clã
4. **Chat Privado** - Conversas individuais

**Interface de Chat:**
```
┌─────────────────────────────────────────┐
│ 💬 Chat: Federação ALPHA                │
├─────────────────────────────────────────┤
│ Contexto: 🏛️ ALPHA > 🌍 Global          │
├─────────────────────────────────────────┤
│ [Global] [Federação] [Clã] [Privado]    │
├─────────────────────────────────────────┤
│ 👤 user123 [ALPHA] [WAR] 14:30          │
│ Preparados para a missão de hoje?       │
│                                         │
│ 👤 leader456 [ALPHA] [LEG] 14:32        │
│ Sim! Todos os clãs estão prontos.       │
│                                         │
│ 👤 member789 [ALPHA] [HER] 14:35        │
│ Vamos dominar! 💪                       │
├─────────────────────────────────────────┤
│ [📎] Digite sua mensagem... [🎤] [📤]   │
└─────────────────────────────────────────┘
```

### 4.5 Sistema VoIP Integrado

**Interface de Chamadas:**
```
┌─────────────────────────────────────────┐
│ 📞 CHAMADAS - Clã Warriors              │
├─────────────────────────────────────────┤
│ 🔊 Sala de Voz Ativa                    │
│ ┌─────────────────────────────────────┐ │
│ │ 👤 leader123    🎤🔊 Falando        │ │
│ │ 👤 member456    🔇   Mudo           │ │
│ │ 👤 member789    👂   Ouvindo        │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ 📋 Contatos do Clã                      │
│ ┌─────────────────────────────────────┐ │
│ │ 👤 user111 🟢 [📞] [💬]             │ │
│ │ 👤 user222 🟡 [📞] [💬]             │ │
│ │ 👤 user333 🔴 [📞] [💬]             │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ 📊 Histórico de Chamadas                │
│ • Reunião de estratégia - 2h atrás      │
│ • Chamada de emergência - 1 dia         │
│ • Briefing semanal - 3 dias             │
└─────────────────────────────────────────┘
```

### 4.6 Configurações e Perfil Aprimorados

**Tela de Configurações Expandida:**
```
┌─────────────────────────────────────────┐
│ ⚙️ CONFIGURAÇÕES                        │
├─────────────────────────────────────────┤
│ 👤 PERFIL                               │
│ ┌─────┐ idcloned                        │
│ │ 📷  │ ADM MASTER                      │
│ │     │ 🏛️ ALPHA | ⚔️ Warriors          │
│ └─────┘ [Alterar Foto]                  │
├─────────────────────────────────────────┤
│ 🔔 NOTIFICAÇÕES                         │
│ • Mensagens do clã         [🔔]         │
│ • Chamadas de voz          [🔔]         │
│ • Missões QRR              [🔔]         │
│ • Guerras de clãs          [🔔]         │
├─────────────────────────────────────────┤
│ 🔒 PRIVACIDADE                          │
│ • Status online visível    [✓]          │
│ • Histórico de chamadas    [✓]          │
│ • Localização no clã       [✓]          │
├─────────────────────────────────────────┤
│ 👑 PAINEL ADMINISTRATIVO (ADM)          │
│ [Acessar Painel Completo]               │
├─────────────────────────────────────────┤
│ 🚪 CONTA                                │
│ [Logout] [Excluir Conta]                │
└─────────────────────────────────────────┘
```

### 4.7 Sistema de Upload de Bandeiras

**Interface de Upload de Bandeira do Clã:**
```
┌─────────────────────────────────────────┐
│ 🏴 BANDEIRA DO CLÃ                      │
├─────────────────────────────────────────┤
│ Bandeira Atual:                         │
│ ┌─────────────┐                         │
│ │             │                         │
│ │   🏴 WAR    │                         │
│ │             │                         │
│ └─────────────┘                         │
├─────────────────────────────────────────┤
│ [📷 Galeria] [📸 Câmera] [🎨 Editor]    │
├─────────────────────────────────────────┤
│ Preview da Nova Bandeira:               │
│ ┌─────────────┐                         │
│ │             │                         │
│ │   [Nova]    │                         │
│ │             │                         │
│ └─────────────┘                         │
├─────────────────────────────────────────┤
│ ✅ Requisitos:                          │
│ • Formato: PNG, JPG                     │
│ • Tamanho: Máx 2MB                      │
│ • Dimensões: 200x200px                  │
├─────────────────────────────────────────┤
│ [Cancelar] [Salvar Bandeira]            │
└─────────────────────────────────────────┘
```


## 5. Arquivos e Componentes para Implementação

### 5.1 Novos Arquivos a Serem Criados

**Painel Administrativo Centralizado:**
- `lib/screens/admin/admin_main_dashboard.dart` - Dashboard principal do ADM
- `lib/screens/admin/admin_user_management.dart` - Gestão completa de usuários
- `lib/screens/admin/admin_organization_management.dart` - Gestão de federações e clãs
- `lib/screens/admin/admin_reports_screen.dart` - Relatórios e logs
- `lib/screens/admin/admin_system_settings.dart` - Configurações do sistema

**Componentes do Painel ADM:**
- `lib/widgets/admin/user_management_card.dart` - Card de usuário com ações
- `lib/widgets/admin/organization_tree_view.dart` - Visualização hierárquica
- `lib/widgets/admin/quick_stats_widget.dart` - Estatísticas rápidas
- `lib/widgets/admin/recent_activities_widget.dart` - Atividades recentes
- `lib/widgets/admin/admin_action_button.dart` - Botões de ação padronizados

**Tela de Exploração Hierárquica:**
- `lib/screens/exploration/federation_explorer_screen.dart` - Exploração principal
- `lib/screens/exploration/federation_detail_enhanced.dart` - Detalhes aprimorados
- `lib/screens/exploration/clan_detail_enhanced.dart` - Detalhes do clã aprimorados

**Componentes de Exploração:**
- `lib/widgets/exploration/federation_card.dart` - Card de federação
- `lib/widgets/exploration/clan_mini_card.dart` - Mini card de clã
- `lib/widgets/exploration/hierarchy_breadcrumb.dart` - Breadcrumb de navegação
- `lib/widgets/exploration/context_indicator.dart` - Indicador de contexto

**Sistema de Upload e Mídia:**
- `lib/screens/media/clan_flag_manager.dart` - Gerenciador de bandeiras
- `lib/screens/media/profile_picture_manager.dart` - Gerenciador de fotos de perfil
- `lib/widgets/media/image_upload_widget.dart` - Widget de upload de imagem
- `lib/widgets/media/image_preview_widget.dart` - Preview de imagem
- `lib/widgets/media/image_editor_widget.dart` - Editor básico de imagem

**Chat Contextual:**
- `lib/screens/chat/contextual_chat_screen.dart` - Chat com contexto
- `lib/widgets/chat/context_selector.dart` - Seletor de contexto
- `lib/widgets/chat/message_with_context.dart` - Mensagem com contexto
- `lib/widgets/chat/chat_member_list.dart` - Lista de membros do chat

**VoIP Integrado:**
- `lib/screens/voip/contextual_voice_screen.dart` - Voz com contexto
- `lib/widgets/voip/voice_room_widget.dart` - Widget de sala de voz
- `lib/widgets/voip/call_participant_card.dart` - Card de participante
- `lib/widgets/voip/voice_controls_widget.dart` - Controles de voz

### 5.2 Arquivos Existentes a Serem Modificados

**Tela Principal (Home):**
- `lib/screens/home_screen.dart` - Adicionar dashboard contextual
  - Implementar diferentes layouts baseados no role do usuário
  - Adicionar estatísticas em tempo real
  - Integrar ações rápidas contextuais

**Navegação Principal:**
- `lib/screens/tabs/` - Reorganizar estrutura de tabs
  - Modificar ordem e funcionalidade das tabs
  - Adicionar nova tab "Explorar"
  - Integrar contexto hierárquico

**Configurações:**
- `lib/screens/settings_screen.dart` - Expandir funcionalidades
  - Adicionar seção de perfil aprimorada
  - Integrar upload de foto de perfil
  - Adicionar acesso ao painel ADM
  - Mostrar afiliações organizacionais

**Serviços de Backend:**
- `lib/services/api_service.dart` - Adicionar novos endpoints
  - Endpoints de gestão de usuários pelo ADM
  - Endpoints de upload de mídia
  - Endpoints de gestão organizacional

**Modelos de Dados:**
- `lib/models/user_model.dart` - Adicionar campos de mídia
- `lib/models/clan_model.dart` - Adicionar campo de bandeira
- `lib/models/federation_model.dart` - Adicionar campo de tag
- `lib/models/admin_action_model.dart` - Novo modelo para ações ADM

### 5.3 Componentes Reutilizáveis Necessários

**Componentes de Interface:**
```dart
// lib/widgets/common/context_aware_app_bar.dart
class ContextAwareAppBar extends StatelessWidget {
  final String currentContext; // "Global", "Federation", "Clan"
  final String? federationTag;
  final String? clanName;
  final VoidCallback? onBackToGlobal;
}

// lib/widgets/common/organization_badge.dart
class OrganizationBadge extends StatelessWidget {
  final String type; // "federation" or "clan"
  final String name;
  final String? tag;
  final String? flagUrl;
  final int memberCount;
}

// lib/widgets/common/user_avatar_with_context.dart
class UserAvatarWithContext extends StatelessWidget {
  final String userId;
  final String username;
  final String? avatarUrl;
  final String? federationTag;
  final String? clanFlag;
  final bool isOnline;
}
```

**Componentes de Gestão:**
```dart
// lib/widgets/management/user_action_sheet.dart
class UserActionSheet extends StatelessWidget {
  final User user;
  final List<AdminAction> availableActions;
  final Function(AdminAction) onActionSelected;
}

// lib/widgets/management/organization_selector.dart
class OrganizationSelector extends StatelessWidget {
  final String type; // "federation" or "clan"
  final List<Organization> organizations;
  final Function(Organization) onSelected;
}

// lib/widgets/management/permission_matrix.dart
class PermissionMatrix extends StatelessWidget {
  final User user;
  final Map<String, bool> permissions;
  final Function(String, bool) onPermissionChanged;
}
```

### 5.4 Estrutura de Diretórios Reorganizada

```
lib/
├── screens/
│   ├── admin/                    # Telas administrativas
│   │   ├── admin_main_dashboard.dart
│   │   ├── admin_user_management.dart
│   │   ├── admin_organization_management.dart
│   │   └── admin_reports_screen.dart
│   ├── exploration/              # Exploração hierárquica
│   │   ├── federation_explorer_screen.dart
│   │   ├── federation_detail_enhanced.dart
│   │   └── clan_detail_enhanced.dart
│   ├── chat/                     # Chat contextual
│   │   ├── contextual_chat_screen.dart
│   │   └── chat_settings_screen.dart
│   ├── voip/                     # VoIP integrado
│   │   ├── contextual_voice_screen.dart
│   │   └── voice_settings_screen.dart
│   ├── media/                    # Gestão de mídia
│   │   ├── clan_flag_manager.dart
│   │   └── profile_picture_manager.dart
│   └── tabs/                     # Tabs reorganizadas
│       ├── home_tab.dart
│       ├── exploration_tab.dart
│       ├── chat_tab.dart
│       ├── voip_tab.dart
│       └── settings_tab.dart
├── widgets/
│   ├── admin/                    # Widgets administrativos
│   ├── exploration/              # Widgets de exploração
│   ├── chat/                     # Widgets de chat
│   ├── voip/                     # Widgets de VoIP
│   ├── media/                    # Widgets de mídia
│   └── common/                   # Widgets comuns
├── services/
│   ├── admin_service.dart        # Serviços administrativos
│   ├── media_service.dart        # Serviços de mídia
│   └── context_service.dart      # Gerenciamento de contexto
└── providers/
    ├── admin_provider.dart       # Estado administrativo
    ├── context_provider.dart     # Estado de contexto
    └── media_provider.dart       # Estado de mídia
```

## 6. Fluxos de Usuário Detalhados

### 6.1 Fluxo do Administrador

**Cenário: ADM quer criar uma nova federação com líder específico**

1. **Acesso ao Painel:** ADM faz login → Sistema detecta role ADM → Redireciona para Dashboard ADM
2. **Navegação:** Dashboard ADM → Seção "Gestão Organizacional" → Botão "Nova Federação"
3. **Criação:** Modal de criação → Campos: Nome, Tag, Líder (opcional) → Busca de usuário para líder
4. **Seleção de Líder:** Lista de usuários disponíveis → Filtros por atividade/experiência → Seleção
5. **Confirmação:** Preview da federação → Confirmação → Criação no backend
6. **Feedback:** Notificação de sucesso → Atualização da visualização hierárquica → Notificação ao líder escolhido

**Cenário: ADM quer transferir um clã entre federações**

1. **Visualização:** Dashboard ADM → Gestão Organizacional → Visualização hierárquica
2. **Seleção:** Clique no clã a ser transferido → Menu de contexto → "Transferir Clã"
3. **Destino:** Seletor de federação de destino → Preview da nova estrutura
4. **Confirmação:** Confirmação com impactos → Execução da transferência
5. **Notificações:** Notificação para membros do clã → Atualização de todas as interfaces

### 6.2 Fluxo do Usuário Regular

**Cenário: Usuário quer explorar federações e entrar em um clã**

1. **Exploração:** Home → Tab "Explorar" → Visualização de todas as federações
2. **Navegação:** Clique em federação → Visualização dos clãs da federação
3. **Interesse:** Clique em clã específico → Detalhes do clã (membros, atividades, bandeira)
4. **Solicitação:** Botão "Solicitar Entrada" → Modal de solicitação com mensagem
5. **Aguardo:** Notificação enviada ao líder → Status "Pendente" para o usuário
6. **Resposta:** Líder aprova/rejeita → Notificação para o usuário → Atualização de status

**Cenário: Membro de clã quer participar de chat e chamada de voz**

1. **Contexto:** Home → Mostra contexto atual (Federação X > Clã Y)
2. **Chat:** Tab "Chat" → Seletor de contexto (Global/Federação/Clã) → Chat do clã
3. **Voz:** Tab "Chamadas" → Sala de voz do clã → Botão "Entrar na Sala"
4. **Participação:** Interface de voz com controles → Lista de participantes → Chat de voz
5. **Saída:** Botão "Sair da Sala" → Retorno ao contexto anterior

### 6.3 Fluxo do Líder de Clã

**Cenário: Líder quer alterar a bandeira do clã**

1. **Acesso:** Home → Painel do Líder (contextual) → Seção "Gestão do Clã"
2. **Bandeira:** Botão "Alterar Bandeira" → Interface de upload
3. **Upload:** Opções: Galeria/Câmera → Seleção de imagem → Editor básico
4. **Preview:** Visualização da nova bandeira em diferentes contextos
5. **Aprovação:** Confirmação → Upload para servidor → Atualização em tempo real
6. **Notificação:** Membros do clã recebem notificação da nova bandeira

## 7. Considerações Técnicas de Implementação

### 7.1 Gerenciamento de Estado

**Provider Pattern Expandido:**
- `ContextProvider` - Gerencia contexto atual (Global/Federação/Clã)
- `AdminProvider` - Estado das funcionalidades administrativas
- `MediaProvider` - Gerencia uploads e cache de mídia
- `HierarchyProvider` - Estado da estrutura organizacional

### 7.2 Cache e Performance

**Estratégia de Cache:**
- Cache de imagens (bandeiras, avatares) com `cached_network_image`
- Cache de dados organizacionais com TTL configurável
- Cache local de contexto do usuário
- Invalidação inteligente baseada em eventos Socket.IO

### 7.3 Responsividade e Acessibilidade

**Design Responsivo:**
- Layouts adaptativos para diferentes tamanhos de tela
- Componentes que se reorganizam em tablets
- Navegação otimizada para dispositivos móveis

**Acessibilidade:**
- Semantic labels para screen readers
- Contraste adequado para todos os elementos
- Navegação por teclado onde aplicável
- Feedback tátil para ações importantes

### 7.4 Integração com Backend

**Endpoints Necessários:**
- `GET /api/admin/dashboard` - Dados do dashboard ADM
- `POST /api/admin/users/{id}/promote` - Promover usuário
- `PUT /api/admin/organizations/transfer` - Transferir organizações
- `POST /api/media/upload` - Upload de mídia
- `GET /api/hierarchy/full` - Estrutura hierárquica completa

**WebSocket Events:**
- `organizationUpdated` - Atualização organizacional
- `userPromoted` - Promoção de usuário
- `mediaUploaded` - Upload de mídia concluído
- `contextChanged` - Mudança de contexto

Este documento fornece a base completa para a implementação das melhorias no frontend, centralizando as funcionalidades administrativas, melhorando a experiência do usuário e integrando todas as capacidades do backend de forma intuitiva e eficiente.

