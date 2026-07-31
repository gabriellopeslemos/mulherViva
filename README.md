# Mulher Viva — Sistema de Agendamento

Sistema completo de agendamento médico com painel administrativo para a clínica Mulher Viva (Dra. Luciana Lopes). Inclui gerenciamento de consultas, notificações por e-mail, integração com Instagram e autoatendimento para pacientes.

---

## Tecnologias

| Camada | Stack |
|--------|-------|
| Frontend | React 19 + Vite + TailwindCSS + Framer Motion |
| Backend | FastAPI (Python) + SQLAlchemy |
| Banco de dados | SQLite (padrão) — configurável via `DATABASE_URL` |
| Autenticação | Google OAuth 2.0 + JWT |
| Notificações | SMTP (e-mail) + ICS (calendário) |
| Integrações | Instagram Graph API |

---

## Estrutura do projeto

```
mulherViva/
├── src/                         # Frontend React
│   ├── App.jsx                  # Página principal (landing page)
│   ├── components/
│   │   ├── BookingSection.jsx   # Formulário de agendamento público
│   │   ├── ManageBooking.jsx    # Autoatendimento (cancelar/reagendar)
│   │   ├── AgendaPanel.jsx      # Painel administrativo
│   │   ├── AdminLogin.jsx       # Login SSO Google
│   │   └── AvailabilityModal.jsx # Editor de disponibilidade
│   └── lib/api.js               # Cliente HTTP para o backend
│
├── backend/
│   └── app/
│       ├── main.py              # Inicialização da aplicação FastAPI
│       ├── config.py            # Variáveis de ambiente (Pydantic Settings)
│       ├── database.py          # Configuração do banco de dados
│       ├── models.py            # Modelos ORM (SQLAlchemy)
│       ├── schemas.py           # Schemas de request/response (Pydantic)
│       ├── auth.py              # Verificação Google OAuth e geração de JWT
│       ├── routers/
│       │   ├── public.py        # Rotas públicas (agendamento, slots, blog)
│       │   ├── admin.py         # Rotas administrativas (CRUD protegido)
│       │   └── auth.py          # Endpoint de login
│       └── services/
│           ├── slots.py         # Cálculo de horários disponíveis
│           ├── notifications.py # Envio de e-mails e geração de ICS
│           ├── instagram.py     # Sincronização com Instagram
│           ├── waitlist.py      # Gerenciamento da fila de espera
│           └── settings.py     # Configurações dinâmicas da aplicação
│
├── .env.development             # Variáveis de ambiente do frontend (dev)
└── backend/.env                 # Variáveis de ambiente do backend
```

---

## Fluxo da aplicação

### Agendamento público (paciente)

1. A paciente acessa a landing page e escolhe a especialidade.
2. O frontend consulta `/api/slots` para exibir os horários disponíveis.
3. A paciente preenche o formulário e submete para `/api/bookings`.
4. O backend valida a disponibilidade, cria o agendamento e envia um e-mail de confirmação com link de autoatendimento e arquivo `.ics` para o calendário.
5. Se não houver vagas, a paciente pode entrar na lista de espera via `/api/waitlist`.

### Autoatendimento (paciente)

- O e-mail de confirmação contém um link com token único: `/gerenciar/{token}`.
- Pela interface de autoatendimento, a paciente pode cancelar ou reagendar a consulta (respeitando a janela de cancelamento configurada).
- Ao cancelar, o sistema notifica automaticamente o próximo da lista de espera.

### Painel administrativo

1. A administradora clica em "Admin" e faz login via Google SSO.
2. O backend verifica o token do Google e confirma se o e-mail está na lista `ALLOWED_ADMIN_EMAILS`.
3. Um JWT é emitido e armazenado no frontend para as requisições subsequentes.
4. No painel, a administradora pode:
   - Visualizar, criar, editar e cancelar agendamentos.
   - Configurar regras de disponibilidade semanais por especialidade.
   - Bloquear ou abrir datas específicas (feriados, horários especiais).
   - Gerenciar a lista de espera.
   - Publicar e editar posts do blog (manualmente ou via sync do Instagram).
   - Ajustar configurações da clínica (janela de cancelamento, antecedência máxima, etc.).

### Notificações automáticas (background)

- **Lembretes**: A cada hora, o backend verifica agendamentos confirmados para o dia seguinte e envia e-mails de lembrete.
- **Instagram**: Se `IG_AUTO_SYNC=true`, o backend sincroniza posts a cada 24 horas.

---

## Como executar (desenvolvimento)

### Pré-requisitos

- Node.js 18+
- Python 3.10+
- Conta Google Cloud com OAuth 2.0 configurado

### 1. Frontend

```bash
# Instalar dependências
npm install

# Criar arquivo de variáveis de ambiente
cp .env.development .env.development.local
# Edite .env.development.local com seu VITE_GOOGLE_CLIENT_ID

# Iniciar servidor de desenvolvimento
npm run dev
# Disponível em http://localhost:5173
```

### 2. Backend

```bash
cd backend

# Criar e ativar ambiente virtual
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate   # macOS/Linux

# Instalar dependências
pip install -r requirements.txt

# Criar arquivo de variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais (veja seção abaixo)

# Iniciar servidor de desenvolvimento
python -m uvicorn app.main:app --reload
# Disponível em http://localhost:8000
# Documentação da API em http://localhost:8000/docs
```

---

## Variáveis de ambiente

Todas as variáveis estão documentadas com comentários nos arquivos de exemplo:

| Arquivo | Para quê |
|---------|----------|
| `.env.example` | Frontend (desenvolvimento) |
| `.env.production.example` | Frontend (build de produção) |
| `backend/.env.example` | Backend (todas as opções) |

Copie cada um removendo o sufixo `.example` e preencha os valores.

> **Atenção:** tudo com prefixo `VITE_` é embutido no bundle e fica **visível
> para qualquer visitante**. Nunca coloque segredos nesses arquivos. O
> *Client ID* do Google é público por design; o *Client Secret* não deve
> aparecer em lugar nenhum do projeto.

### Variáveis obrigatórias em produção

A API **se recusa a iniciar** se alguma destas estiver insegura. Isso é
proposital: evita subir para a internet uma instalação com os padrões de
desenvolvimento.

| Variável | Regra |
|----------|-------|
| `ENVIRONMENT` | Precisa ser `production` para ativar as validações |
| `SECRET_KEY` | Mínimo de 32 caracteres e diferente do padrão (`openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID` | Preenchido — sem ele o login do painel não funciona |
| `ALLOWED_ADMIN_EMAILS` | Ao menos um e-mail, senão ninguém acessa o painel |
| `CORS_ORIGINS` | Domínios reais em `https`. Não aceita `*` |
| `PUBLIC_BASE_URL` | Precisa usar `https://` (vai nos links dos e-mails) |
| `SMTP_HOST` | Obrigatório quando `NOTIFICATIONS_ENABLED=true` |

---

## Deploy em produção

### Opção A — Docker Compose (recomendado)

```bash
# 1. Configure o backend
cp backend/.env.example backend/.env
#    Edite backend/.env:
#      ENVIRONMENT=production
#      SECRET_KEY=$(openssl rand -hex 32)
#      GOOGLE_CLIENT_ID, ALLOWED_ADMIN_EMAILS, CORS_ORIGINS, PUBLIC_BASE_URL

# 2. Configure o build do frontend
export VITE_API_URL=https://api.seudominio.com.br
export VITE_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com

# 3. Suba
docker compose up -d --build
```

Sobe dois contêineres:

- **api** — FastAPI sob Gunicorn/Uvicorn em `127.0.0.1:8000`, banco em volume nomeado
- **web** — build estático servido por nginx em `127.0.0.1:8080`

Ambos escutam **apenas em localhost** de propósito. Coloque um proxy com TLS
(Caddy, Traefik, nginx do host ou Cloudflare Tunnel) na frente — nenhum dos
dois termina HTTPS sozinho.

### Opção B — Host estático + API separada

O frontend é um site estático; a pasta `dist/` serve em qualquer host.

```bash
cp .env.production.example .env.production   # e preencha
npm ci && npm run build                      # gera dist/
```

O host **precisa** de fallback SPA (toda rota serve `index.html`), senão o link
de autoatendimento `/?manage=<token>` enviado por e-mail quebra ao recarregar:

- **Netlify** — já incluso em `public/_redirects`
- **Vercel** — já incluso em `vercel.json`
- **nginx próprio** — use o `nginx.conf` do repositório
- **Apache** — `FallbackResource /index.html`

Para a API, use o `backend/Dockerfile` ou rode direto:

```bash
cd backend
pip install -r requirements.txt
gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 1 -b 0.0.0.0:8000
```

> **Sobre `-w 1`:** o limitador de requisições e o loop de lembretes vivem na
> memória do processo. Cada worker extra teria a própria cópia dos dois (o
> limite efetivo vira `N × limite`, e os lembretes seriam enviados N vezes).
> Para escalar, use mais contêineres atrás do proxy — não mais workers.

### Checklist antes de publicar

- [ ] `backend/.env` com `ENVIRONMENT=production` e `SECRET_KEY` gerado
- [ ] `GOOGLE_CLIENT_ID` idêntico no backend e no frontend
- [ ] Origens autorizadas no Google Cloud Console incluem o domínio do site
- [ ] `CORS_ORIGINS` e `PUBLIC_BASE_URL` apontando para os domínios reais em `https`
- [ ] `ALLOWED_HOSTS` preenchido se a API estiver exposta diretamente
- [ ] `TRUST_PROXY_HEADERS=true` **somente** se houver um proxy reverso confiável na frente
- [ ] `connect-src` no `nginx.conf` atualizado para o domínio real da API
- [ ] Domínio real substituído em `index.html` (canonical/OG), `public/robots.txt` e `public/sitemap.xml`
- [ ] SMTP configurado e `NOTIFICATIONS_ENABLED=true` (sem isso não sai nenhum e-mail)
- [ ] TLS ativo, e `Strict-Transport-Security` descomentado no `nginx.conf`
- [ ] Rotina de backup do banco definida (veja abaixo)
- [ ] Fotos reais substituindo os placeholders (veja "Imagens")
- [ ] Telefone, e-mail e endereço conferidos em `src/lib/siteConfig.js`
- [ ] Disponibilidade semanal cadastrada no painel (sem regras, nenhum horário aparece)

---

## Segurança

O que já está implementado:

| Proteção | Como funciona |
|----------|---------------|
| Validação de configuração | A API não inicia em produção com chave padrão, CORS aberto ou URL sem HTTPS |
| Autenticação | Google SSO verificado no servidor + JWT; o e-mail é reconferido na allowlist a cada requisição, então remover um admin revoga o acesso na hora |
| Rate limiting | Por IP, com limite mais rígido para login, agendamento, lista de espera e contato |
| Cabeçalhos HTTP | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, CSP, HSTS (produção) |
| Agendamento duplo | Índice único no banco — a checagem de disponibilidade sozinha não é atômica |
| Vazamento de dados | A lista de espera devolve sempre a mesma resposta, sem confirmar se um e-mail já está cadastrada nem devolver os dados salvos |
| XSS armazenado | URLs de imagem/link só aceitam `http(s)`, bloqueando `javascript:` |
| Injeção de cabeçalho | Valores vindos do formulário têm CR/LF removidos antes de virarem cabeçalho de e-mail |
| Docs da API | `/docs` e `/openapi.json` desativados em produção |

### Ainda recomendado

- **Backup**: com SQLite, agende `sqlite3 mulherviva.db ".backup /backup/mv-$(date +%F).db"`.
  Para volume maior, migre para PostgreSQL trocando `DATABASE_URL`.
- **LGPD**: o sistema guarda nome, e-mail, telefone e motivo da consulta.
  Publique uma política de privacidade e defina por quanto tempo os dados ficam armazenados.
- **Monitoramento**: `/health` (vivo) e `/health/ready` (banco acessível) já estão prontos para o healthcheck do orquestrador.

---

## Imagens

As imagens são placeholders SVG gerados em `src/lib/placeholderImages.js`.
Para usar fotos reais, coloque os arquivos em `src/assets/` e troque os imports
em `src/App.jsx`. Use WebP/AVIF e mantenha cada arquivo abaixo de ~200 kB.

Dados da clínica (telefone, e-mail, endereço, WhatsApp) ficam centralizados em
`src/lib/siteConfig.js` — edite só esse arquivo.

---

## Testes

```bash
# Backend
cd backend && pip install -r requirements-dev.txt && python -m pytest -q

# Frontend
npm run lint && npm run build
```

O CI (`.github/workflows/ci.yml`) roda os dois a cada push e PR, e ainda
verifica que a API realmente se recusa a iniciar com `SECRET_KEY` padrão.

---

## Modelos de dados principais

| Modelo | Descrição |
|--------|-----------|
| `Specialty` | Especialidades médicas com duração de slot |
| `AvailabilityRule` | Disponibilidade semanal recorrente por especialidade |
| `AvailabilityOverride` | Bloqueios/aberturas em datas específicas |
| `Appointment` | Agendamentos com status (pending / confirmed / cancelled / completed / no_show) |
| `WaitlistEntry` | Fila de espera para horários indisponíveis |
| `BlogPost` | Posts do blog (manual ou via Instagram) |
| `AppSetting` | Configurações dinâmicas da aplicação |

---

## Scripts disponíveis (frontend)

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia o servidor de desenvolvimento Vite |
| `npm run build` | Gera o build de produção em `dist/` |
| `npm run preview` | Visualiza o build de produção localmente |
| `npm run lint` | Executa o ESLint |
