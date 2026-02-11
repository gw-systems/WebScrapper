# CI/CD Pipeline Guide

## Overview

The WebScraper project uses GitHub Actions for Continuous Integration and Continuous Deployment (CI/CD). This ensures code quality, automated testing, and reliable deployments across environments.

## Workflows

### 1. Test and Lint (`test.yml`)

Runs on every push to `main` and `develop` branches, and all Pull Requests.

**Steps:**
1. **Checkout Code**: Retrieves the latest code.
2. **Setup Environment**: Installs Node.js 18 and PostgreSQL 14 service.
3. **Install Dependencies**: Installs project dependencies.
4. **Linting**: Runs ESLint to check for code style issues.
5. **Testing**: Runs Jest tests with coverage reporting.
6. **Coverage Check**: Fails the build if test coverage is below 60%.
7. **Report**: Uploads coverage reports to Codecov and comments on PRs.

### 2. Deploy (`deploy.yml`)

Runs on pushes to `main` (after tests pass) or manual trigger.

**Jobs:**
1. **Build and Push**:
   - Builds Docker images for Backend and Frontend.
   - Pushes images to GitHub Container Registry (ghcr.io).
   - Use multi-stage builds for optimization.

2. **Deploy (Staging/Production)**:
   - Deploys the application to the target environment.
   - Runs smoke tests to verify health.

## Configuration

### GitHub Secrets

The following secrets must be configured in the repository settings:

| Secret | Description |
|--------|-------------|
| `DB_PASSWORD` | Database password for tests |
| `API_KEY_SECRET` | Secret for API key encryption |
| `JWT_SECRET` | Secret for JWT signing |
| `SSH_PRIVATE_KEY` | (Optional) For SSH-based deployment |
| `KUBE_CONFIG` | (Optional) For Kubernetes deployment |

### Docker Setup

The project includes `docker-compose.yml` for local development and testing the full stack:
- Backend API
- Frontend
- PostgreSQL
- Prometheus
- Grafana
- pgAdmin (optional)

## Running Locally

To test the CI/CD process locally:

1. **Run Tests**:
   ```bash
   cd backend
   npm test
   ```

2. **Run Linter**:
   ```bash
   cd backend
   npm run lint
   ```

3. **Build Docker Images**:
   ```bash
   docker-compose build
   ```

4. **Start Stack**:
   ```bash
   docker-compose up
   ```

## Deployment Strategy

### Staging
- Automatically deployed from `main` branch.
- Used for final verification before production.
- Uses staging configuration secrets.

### Production
- Manually triggered via GitHub Actions UI.
- Requires approval (can be configured in GitHub environments).
- Uses production configuration secrets.
- Rolling updates (zero downtime) if using Kubernetes/Swarm.

## Troubleshooting CI/CD

- **Linting Failures**: Run `npm run lint -- --fix` locally to fix style issues.
- **Test Failures**: Check the "Test" step logs in GitHub Actions. Ensure tests pass locally.
- **Build Failures**: Check Docker logs. Ensure `Dockerfile` is correct.
- **Coverage Failures**: Add more unit/integration tests to reach 60% coverage.
