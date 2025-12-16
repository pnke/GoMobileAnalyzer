# ServerGo - Go Analysis Backend

Python FastAPI backend for the Go Analysis App. Provides KataGo AI analysis and board recognition services.

## Features

- **KataGo Analysis** - AI-powered move evaluation with winrate and score
- **Board Recognition** - ML-based detection of physical Go boards from photos
- **Streaming Analysis** - Real-time SSE streaming for progressive results
- **Security** - API key auth, rate limiting, request size limits

## Quick Start

```bash
# 1. Create virtual environment
python -m venv venv
.\venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your KataGo paths

# 4. Run server
python main.py
```

Server runs at `http://0.0.0.0:8000`

## Project Structure

```
ServerGo/
├── core/                   # Shared business logic
│   ├── analysis/          # KataGo engine (sync_engine, async_engine)
│   ├── recognition/       # ML models (segmentation, classifier)
│   └── sgf/               # SGF parsing and validation
├── services/              # Service layer
│   ├── katago_service.py  # KataGo orchestration
│   └── universal_go_recognizer.py  # Board recognition pipeline
├── routers/               # FastAPI endpoints
│   └── v1/               # API v1 routes
├── schemas/               # Pydantic models
├── middleware/            # CORS, rate limiting, auth
├── serverless/            # RunPod deployment
└── tests/                 # pytest test suite
```

## Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `KATAGO_PATH` | ✓ | Path to KataGo executable |
| `KATAGO_MODEL` | ✓ | Path to neural network model |
| `KATAGO_CONFIG` | ✓ | Path to analysis config file |
| `API_KEY` | Optional | API key for authentication |
| `RATE_LIMIT_REQUESTS` | Optional | Requests per minute (default: 30) |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/analyze` | POST | Analyze SGF with KataGo |
| `/v1/recognize/board` | POST | Detect board from image |
| `/health` | GET | Health check |

See [API-CONTRACTS.md](../docs/API-CONTRACTS.md) for full documentation.

## Development

```bash
# Run tests
python run_tests.py

# Run tests with coverage
pytest --cov=. --cov-report=html

# Type checking
mypy .

# Linting
ruff check .
```

## Deployment

### Local Development
```bash
python main.py
```

### Docker (RunPod)
See `serverless/` for GPU cloud deployment configuration.

```bash
cd serverless
docker build -t go-analysis-engine .
docker run --gpus all -p 8000:8000 go-analysis-engine
```

## Related Documentation

- [ADR-001: Backend Architecture](../docs/ADR-001-Backend-Architecture.md)
- [ADR-003: ML Recognition](../docs/ADR-003-ML-Recognition.md)
- [API Contracts](../docs/API-CONTRACTS.md)
