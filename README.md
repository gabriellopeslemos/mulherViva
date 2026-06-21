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

### Frontend (`.env.development`)

```env
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
```

### Backend (`backend/.env`)

```env
# Segurança
SECRET_KEY=gere-com-openssl-rand-hex-32
ACCESS_TOKEN_EXPIRE_MINUTES=720

# Google OAuth
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
ALLOWED_ADMIN_EMAILS=admin@exemplo.com,outro@exemplo.com

# Banco de dados
DATABASE_URL=sqlite:///./mulherviva.db

# CORS
CORS_ORIGINS=http://localhost:5173

# Política de agendamento
MIN_BOOKING_LEAD_HOURS=2
BUFFER_MINUTES=0
CANCELLATION_WINDOW_HOURS=12
MAX_BOOKING_ADVANCE_DAYS=60

# E-mail (desabilitado por padrão)
NOTIFICATIONS_ENABLED=false
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_USE_TLS=true
EMAIL_FROM=Mulher Viva <no-reply@mulherviva.com.br>
PUBLIC_BASE_URL=http://localhost:5173

# Instagram (opcional)
IG_ACCESS_TOKEN=
IG_AUTO_SYNC=false

# Dados da clínica
CLINIC_NAME=Mulher Viva — Dra. Luciana Lopes
CLINIC_ADDRESS=Centro Médico Lúcio Costa
```

---

## Build para produção

```bash
# Frontend — gera arquivos em dist/
npm run build

# Backend — use um servidor ASGI em produção
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

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
