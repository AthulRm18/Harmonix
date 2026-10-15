# EngineSense Makefile
# `make demo` brings everything up from scratch.

.PHONY: help install dev backend-dev frontend-dev test lint demo \
        db-reset seed docker-up docker-down clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Installation ──────────────────────────────────────────────────

install: ## Install all dependencies
	cd backend && pip install -e ".[dev]"
	cd frontend && npm install

# ── Development ───────────────────────────────────────────────────

backend-dev: ## Start backend dev server
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend-dev: ## Start frontend dev server
	cd frontend && npm run dev

dev: ## Start both backend and frontend (requires two terminals)
	@echo "Run 'make backend-dev' and 'make frontend-dev' in separate terminals"

# ── Testing ───────────────────────────────────────────────────────

test: ## Run all tests
	cd backend && python -m pytest tests/ -v --tb=short
	cd frontend && npm run test

test-backend: ## Run backend tests only
	cd backend && python -m pytest tests/ -v --tb=short

test-frontend: ## Run frontend tests only
	cd frontend && npm run test

test-e2e: ## Run Playwright end-to-end tests
	cd frontend && npx playwright test

# ── Linting ───────────────────────────────────────────────────────

lint: ## Run linters
	cd backend && ruff check . && ruff format --check .
	cd frontend && npm run lint

lint-fix: ## Fix lint issues
	cd backend && ruff check --fix . && ruff format .
	cd frontend && npm run lint -- --fix

# ── Database ──────────────────────────────────────────────────────

db-reset: ## Reset the database (WARNING: destroys all data)
	cd backend && python -c "from app.db import engine, Base; import asyncio; asyncio.run(Base.metadata.drop_all(engine))"
	cd backend && python -c "from app.db import engine, Base; import asyncio; asyncio.run(Base.metadata.create_all(engine))"

seed: ## Seed the database with demo data
	cd backend && python -m app.seed

# ── Docker ────────────────────────────────────────────────────────

docker-up: ## Start all services via Docker Compose
	docker compose up -d --build

docker-down: ## Stop all services
	docker compose down

docker-logs: ## Follow all service logs
	docker compose logs -f

# ── Demo ──────────────────────────────────────────────────────────

demo: ## Full demo: build, start, seed, and open browser
	docker compose up -d --build
	@echo "Waiting for services..."
	@sleep 10
	@echo "Seeding database..."
	docker compose exec api python -m app.seed
	@echo ""
	@echo "╔══════════════════════════════════════════════╗"
	@echo "║  EngineSense is ready!                       ║"
	@echo "║                                              ║"
	@echo "║  Frontend:  http://localhost:5173             ║"
	@echo "║  API:       http://localhost:8000/docs        ║"
	@echo "║  MLflow:    http://localhost:5000              ║"
	@echo "╚══════════════════════════════════════════════╝"

# ── Cleanup ───────────────────────────────────────────────────────

clean: ## Remove build artifacts and caches
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
	rm -rf backend/data/ frontend/dist/
