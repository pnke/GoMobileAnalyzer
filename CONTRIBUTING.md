# Contributing to Go Analysis Project

Welcome! We appreciate every contribution to this project.

## 🚀 Quick Start

### Prerequisites

| Component | Version | Note |
|-----------|---------|------|
| Node.js | 18+ LTS | For the Mobile App |
| Python | 3.10+ | For the Backend |
| Git | 2.x | Version Control |
| KataGo | 1.16+ | Optional for local backend |

### Local Setup

#### 1. Clone Repository

```bash
git clone <repository-url>
cd GoRemoteAnalyse
```

#### 1.5 Pre-Commit Hooks (Recommended)

```bash
# One-time installation
pip install pre-commit
pre-commit install

# Run all checks manually
pre-commit run --all-files
```

> **Tip**: Pre-commit automatically prevents unformatted or faulty code from being committed.

#### 2. Mobile App (App/)

```bash
cd App
npm install
npx expo start
```

The app starts in development mode. Scan the QR code with Expo Go on your phone.

#### 3. Backend (ServerGo/)

```bash
cd ServerGo
python -m venv venv

# Windows:
.\venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt

# Optional: Set environment variables
cp .env.example .env  # Adjust if available
```

To start:
```bash
DEV=true python main.py
```

> **Note**: KataGo is only required if you want to test the backend locally with real analyses.

---

## 🛠️ Troubleshooting

### Mobile App

| Problem | Solution |
|---------|----------|
| `expo start` fails | `rm -rf node_modules && npm install` |
| Metro Bundler hangs | Clear cache: `npx expo start -c` |
| TypeScript errors | `npx tsc --noEmit` to see all errors |

### Backend

| Problem | Solution |
|---------|----------|
| `ModuleNotFoundError` | Is venv activated? `pip install -r requirements.txt` |
| Port 8000 in use | `uvicorn main:app --port 8001` |
| KataGo not found | Set paths in `.env` (KATAGO_PATH, KATAGO_MODEL, KATAGO_CONFIG) |
| Logging shows nothing | `LOG_LEVEL=DEBUG python main.py` |

---

## 📁 Project Structure

```
GoRemoteAnalyse/
├── App/                    # React Native (Expo) Frontend
│   ├── components/         # UI Components
│   ├── context/            # React Contexts (State)
│   ├── hooks/              # Custom Hooks
│   ├── lib/                # Utilities, API Client
│   ├── config/             # Central Configuration
│   └── __tests__/          # Jest Tests
├── ServerGo/               # Python FastAPI Backend
│   ├── routers/            # API Endpoints
│   ├── services/           # Business Logic
│   ├── middleware/         # Request Processing
│   ├── common/             # Shared Code (KataGo Engine)
│   └── tests/              # Pytest Tests
└── docs/                   # Architecture Documentation (ADRs)
```

---

## 🧪 Running Tests

### Frontend
Tests are located in `App/__tests__/`.

```bash
cd App
npm test                    # All tests
npm test -- --watch         # Watch Mode
npm test -- --coverage      # With Coverage Report
npx tsc --noEmit            # TypeScript Check
```

### Backend
Tests are located in `ServerGo/tests/`.

```bash
cd ServerGo
python -m pytest tests/ -v          # All tests
python -m pytest tests/ -v -k "api" # API tests only
python -m pytest --cov=.            # With Coverage
```

---

## 📝 Code Style

### TypeScript/React Native

- Follow ESLint rules (`npm run lint`)
- Use Functional Components with Hooks
- Define Props interfaces explicitly
- Defensive Programming: Null checks before array access

### Python

- Formatter: Black (`black .`)
- Linter: Ruff or flake8
- Type hints for all functions
- Use structured logging

---

## 🔄 Pull Request Process

1. **Create branch**: `feature/description` or `fix/description`
2. **Make changes** + write tests
3. **Run tests locally**: Frontend + Backend
4. **Create PR** with:
   - Description of the change
   - Screenshots (for UI changes)
   - Mark breaking changes
5. **Wait for review** + incorporate feedback

---

## 📚 Further Documentation

- [ADR-001: Backend Architecture](docs/ADR-001-Backend-Architecture.md)
- [ADR-002: Frontend Architecture](docs/ADR-002-Frontend-Architecture.md)
- [API Contracts](docs/API-CONTRACTS.md)
