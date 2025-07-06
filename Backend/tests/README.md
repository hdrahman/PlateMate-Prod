# PlateMate Backend Tests

This directory contains tests for the PlateMate backend services.

## Test Structure

- `api/` - API integration tests for FastAPI endpoints
- `services/` - Unit tests for backend services

## Running Tests

To run all tests:

```bash
cd Backend
python -m pytest
```

To run specific test files:

```bash
python -m pytest tests/api/test_food.py
```

To run tests with verbose output:

```bash
python -m pytest -v
```

## Test Coverage

To run tests with coverage:

```bash
python -m pytest --cov=.
```

## Mocking External Services

The tests use pytest's monkeypatch and unittest.mock to mock external services like FatSecret API.
This ensures tests can run without actual API credentials or network connectivity. 