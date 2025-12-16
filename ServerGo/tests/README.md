# Backend Server Tests

This directory contains tests for the Go Analysis Server backend.

## Test Structure

- `test_sgf_processing.py` - Tests for SGF parsing and processing functions
- `test_api_endpoints.py` - Tests for FastAPI endpoints with mocking
- `test_katago_communication.py` - Tests for KataGo communication functions
- `conftest.py` - pytest configuration and fixtures
- `requirements.txt` - Test-specific dependencies

## Running Tests

To run the tests, first install the test dependencies:

```bash
pip install -r requirements.txt
```

Then run the tests:

```bash
# Run all tests
python -m pytest

# Run tests with verbose output
python -m pytest -v

# Run a specific test file
python -m pytest test_sgf_processing.py

# Run tests and generate coverage report
python -m pytest --cov=.
```

## Test Categories

### Unit Tests
- Test individual functions in isolation
- Use fixtures for sample data
- Mock external dependencies

### Integration Tests
- Test API endpoints
- Test complete workflows
- Mock only external services (like KataGo)

### Mocking Strategy
- Use unittest.mock for mocking
- Mock KataGo process communication
- Use pytest fixtures for reusable test data

---

## E2E / Integration Tests with Real KataGo

For full end-to-end testing with a real KataGo instance, follow these steps:

### Prerequisites

1. **KataGo installed locally** with a valid model and config
2. **Environment variables** set in `.env`:
   ```bash
   KATAGO_PATH=/path/to/katago
   KATAGO_MODEL=/path/to/model.bin.gz
   KATAGO_CONFIG=/path/to/analysis.cfg
   ```

### Running E2E Tests

```bash
# 1. Start the server with real KataGo
cd ServerGo
python main.py

# 2. In another terminal, run the E2E test
curl -X POST http://localhost:8000/api/v1/analyses \
  -H "Content-Type: application/json" \
  -d '{"sgf": "(;GM[1]SZ[19];B[pd];W[dp])", "visits": 100}'
```

### Docker E2E Testing

```bash
# Full test suite with docker-compose
docker compose -f docker-compose.test.yml up --build

# CI-Lite: Faster, minimal dependencies (no KataGo)
docker compose -f docker-compose.ci-lite.yml up --build

# Quick test with Dockerfile.test
docker build -f Dockerfile.test -t goremote-test .
docker run --rm goremote-test
```

> **Tip**: Use `docker-compose.ci-lite.yml` for local development to run unit tests quickly without GPU dependencies.

### Note
E2E tests are **not run in CI** due to:
- KataGo binary/model size (~2GB)
- GPU requirements for reasonable speed
- Cost of cloud GPU runners

Run these manually before major releases.
