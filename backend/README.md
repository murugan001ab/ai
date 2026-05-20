# IS4 AI Surveillance System — Backend

Production-ready FastAPI backend for the IS4 AI Surveillance System covering PPE Detection, Face Recognition, Idle Detection, Zone Violation, Camera Management, User Management, and a live Dashboard.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI + Uvicorn |
| ORM | SQLModel + Async SQLAlchemy |
| Database | PostgreSQL (asyncpg) |
| Migrations | Alembic |
| Auth | JWT (python-jose) + bcrypt |
| Events | Kafka (aiokafka) |
| Live Feed | WebSocket |
| Config | pydantic-settings (.env) |

---

## Quick Start

### 1. Clone & configure
```bash
cp .env.example .env
# Edit .env — set SECRET_KEY and DATABASE_URL
```

### 2. Docker (recommended)
```bash
docker-compose up -d
```

### 3. Local dev
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

---

## Alembic Migrations

```bash
# Auto-generate migration after model changes
alembic revision --autogenerate -m "describe change"

# Apply
alembic upgrade head

# Rollback one step
alembic downgrade -1
```

---

## Project Structure

```
app/
├── api/
│   ├── routes/          # FastAPI routers (auth, users, roles, zones, cameras, events, dashboard)
│   └── deps/            # Dependency injection (JWT auth, DB session)
├── core/
│   ├── config.py        # pydantic-settings (.env)
│   ├── security.py      # JWT + bcrypt helpers
│   └── database.py      # Async SQLAlchemy engine + session
├── models/              # SQLModel table models (all 17 tables)
├── schemas/             # Pydantic v2 request/response schemas
├── crud/                # Generic async CRUD base + per-model instances
├── services/            # Business logic (AuthService, AIEventService)
├── kafka/               # Producer + Consumer (aiokafka, graceful fallback)
├── websocket/           # ConnectionManager + WebSocket routes
├── utils/               # Helpers, exception handlers
└── main.py              # App factory + lifespan

alembic/                 # Migration environment
docker-compose.yml       # PostgreSQL + Kafka + API
```

---

## API Endpoints (all under `/api/v1`)

| Module | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `GET /auth/profile` |
| Users | `GET/POST /users`, `GET/PATCH/DELETE /users/{id}` |
| Roles | `GET/POST /roles`, `GET/PATCH/DELETE /roles/{id}` |
| Zones | `GET/POST /zones`, `GET/PATCH/DELETE /zones/{id}` |
| Equipment | `GET/POST /equipments`, `GET/PATCH/DELETE /equipments/{id}` |
| Zone Rules | `GET/POST /zone-equipment-rules`, `DELETE /zone-equipment-rules/{id}` |
| Zone Perms | `GET/POST /user-zone-permissions`, `DELETE /user-zone-permissions/{id}` |
| Cameras | `GET/POST /cameras`, `GET/PATCH/DELETE /cameras/{id}` |
| AI Configs | `GET/POST /camera-ai-configs`, `GET/PATCH/DELETE /camera-ai-configs/{id}` |
| AI Events | `GET/POST /ai-events`, `GET/DELETE /ai-events/{id}` |
| PPE Events | `GET/POST /ppe-events`, `GET /ppe-events/{id}` |
| Face Events | `GET/POST /face-events`, `GET /face-events/{id}` |
| Idle Events | `GET/POST /idle-events`, `GET /idle-events/{id}` |
| Zone Violations | `GET/POST /zone-violations`, `GET /zone-violations/{id}` |
| Alerts | `GET/POST /alerts`, `GET/PATCH /alerts/{id}` |
| Worker Images | `GET/POST /worker-images`, `GET/DELETE /worker-images/{id}` |
| Dashboard | `GET /dashboard-sessions`, `GET /dashboard-sessions/{id}` |
| Settings | `GET/POST /system-settings`, `GET/PATCH/DELETE /system-settings/{id}` |

## WebSocket Endpoints

| Path | Description |
|---|---|
| `ws://host/ws/dashboard` | Global live event feed |
| `ws://host/ws/camera/{id}` | Per-camera live feed |
| `ws://host/ws/zone/{id}` | Per-zone live feed |

Send `ping` → receive `pong` for keepalive.
