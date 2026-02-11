# Secrets Management Guide

## Overview

This guide covers secure management of sensitive configuration data (secrets) for the WebScraper application, including API keys, database passwords, and cryptographic keys.

## Table of Contents

- [Quick Start](#quick-start)
- [Required Secrets](#required-secrets)
- [Generating Secrets](#generating-secrets)
- [Validating Secrets](#validating-secrets)
- [Environment-Specific Configuration](#environment-specific-configuration)
- [Production Deployment](#production-deployment)
- [Secrets Rotation](#secrets-rotation)
- [Integration with Secret Managers](#integration-with-secret-managers)
- [Best Practices](#best-practices)

---

## Quick Start

### Development

```bash
# 1. Copy the example file
cp .env.example .env

# 2. Generate secure secrets
node scripts/generate-secrets.js

# 3. Update .env with generated secrets and your database password

# 4. Validate configuration
node scripts/validate-secrets.js
```

###Production

```bash
# 1. Use a secrets manager (recommended) OR generate secrets locally
node scripts/generate-secrets.js

# 2. Set environment variables via your deployment platform
#    - AWS: Systems Manager Parameter Store / Secrets Manager
#    - Heroku: Config Vars
#    - Docker: Secrets or environment variables
#    - Kubernetes: Secrets

# 3. Validate before deploying
NODE_ENV=production node scripts/validate-secrets.js
```

---

## Required Secrets

| Variable | Purpose | Min Length | Example |
|----------|---------|------------|---------|
| **DB_PASSWORD** | PostgreSQL password | 12 chars | `aX9$mP2nQ7!wE5rT` |
| **API_KEY_SECRET** | API key encryption | 32 chars | `a1b2c3d4e5f6...` (64 hex) |
| **JWT_SECRET** | JWT token signing | 32 chars | `9z8y7x6w5v4u...` (64 hex) |

### Database Configuration

All database variables are required:

```bash
DB_HOST=localhost              # Database server hostname
DB_PORT=5432                   # PostgreSQL port
DB_NAME=webscraper             # Database name
DB_USER=webscraper_user        # Database username
DB_PASSWORD=<SECURE_PASSWORD>  # Database password (12+ chars)
```

### Security Keys

```bash
API_KEY_SECRET=<64_HEX_CHARS>  # For API key encryption
JWT_SECRET=<64_HEX_CHARS>      # For JWT token signing
```

> [!CAUTION]
> **Never use default values in production!**
> The `.env.example` file contains placeholder values like `GENERATE_THIS_SECRET_DO_NOT_USE_THIS_VALUE`. These MUST be replaced with secure, randomly-generated values.

---

## Generating Secrets

### Using the Built-in Script

The project includes a secret generation script:

```bash
node scripts/generate-secrets.js
```

**Output:**
```
Generated Secure Secrets
========================

API_KEY_SECRET=a1b2c3d4e5f6...
JWT_SECRET=9z8y7x6w5v4u...

Copy these values to your .env file
NEVER commit these to version control!
```

### Manual Generation

#### Using Node.js

```javascript
require('crypto').randomBytes(32).toString('hex')
// Output: 64 hex characters
```

#### Using OpenSSL

```bash
openssl rand -hex 32
# Output: 64 hex characters
```

#### Using Python

```python
import secrets
secrets.token_hex(32)
# Output: 64 hex characters
```

### Database Password Requirements

**Minimum Requirements:**
- 12+ characters (20+ recommended for production)
- Mix of uppercase, lowercase, numbers, and symbols
- No dictionary words
- No personal information

**Good Examples:**
- `aX9$mP2nQ7!wE5rT3yU8iO1pA4sD6fG7hJ`
- `K2#mN5@qW8!eR1tY4uI9oP3aS6dF0gH7jK`

**Bad Examples:**
- ❌ `password123` (weak, dictionary word)
- ❌ `webscraper2024` (predictable)
- ❌ `admin` (extremely weak)

---

## Validating Secrets

The validation script checks your configuration before deployment:

```bash
node scripts/validate-secrets.js
```

### What It Checks

✅ **Required Variables**: All necessary environment variables are set  
✅ **Secret Strength**: Secrets meet minimum length requirements  
✅ **Weak Defaults**: No default/placeholder values in use  
✅ **Production Checks**: HTTPS, appropriate logging, resource limits  

### Example Output

```
WebScraper Secrets Validation
============================================================

Checking Required Variables...
✓ NODE_ENV: Present
✓ DB_PASSWORD: Present
✓ API_KEY_SECRET: Present
✓ JWT_SECRET: Present
...

Checking Secret Strength...
✓ API_KEY_SECRET: Strong (64 characters)
✓ JWT_SECRET: Strong (64 characters)
✓ DB_PASSWORD: Strong (24 characters)

Production Environment Checks...
✓ All production checks passed

Current Configuration:
  Environment: production
  Database: rds.amazonaws.com:5432/webscraper
  Max Browsers: 20 total, 3 per user

============================================================
Validation Summary

✓ Passed: 14 variables
✓ Validation PASSED
Configuration is secure and ready for deployment
```

---

## Environment-Specific Configuration

### Development (.env)

```bash
NODE_ENV=development
DB_HOST=localhost
DB_PASSWORD=dev_password_not_for_production
API_KEY_SECRET=<generated_dev_secret>
JWT_SECRET=<generated_dev_secret>
LOG_LEVEL=debug
MAX_BROWSERS_TOTAL=5
```

### Staging (.env.staging)

```bash
NODE_ENV=staging
DB_HOST=staging-db.internal
DB_PASSWORD=<strong_staging_password>
API_KEY_SECRET=<unique_staging_secret>
JWT_SECRET=<unique_staging_secret>
FRONTEND_URL=https://staging.yourapp.com
LOG_LEVEL=info
MAX_BROWSERS_TOTAL=10
```

### Production (.env.production or Platform Config)

```bash
NODE_ENV=production
DB_HOST=prod-rds.us-east-1.rds.amazonaws.com
DB_PASSWORD=<loaded_from_secrets_manager>
API_KEY_SECRET=<loaded_from_secrets_manager>
JWT_SECRET=<loaded_from_secrets_manager>
FRONTEND_URL=https://yourapp.com
LOG_LEVEL=warn
MAX_BROWSERS_TOTAL=20
MAX_BROWSERS_PER_USER=3
```

> [!IMPORTANT]
> **Use different secrets for each environment!**
> Never reuse production secrets in staging or development.

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Generate unique, secure secrets for production
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS for `FRONTEND_URL`
- [ ] Use strong database password (20+ characters)
- [ ] Run `node scripts/validate-secrets.js`
- [ ] Configure secrets via platform (not .env files)
- [ ] Set appropriate resource limits
- [ ] Configure log level to `warn` or `error`
- [ ] Verify `.env` is in `.gitignore`
- [ ] Document secret rotation schedule

### Deployment Platforms

#### AWS (Recommended)

**Using AWS Secrets Manager:**

```javascript
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

async function getSecret(secretName) {
    const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
    return JSON.parse(data.SecretString);
}

// In your application startup
const secrets = await getSecret('webscraper/production');
process.env.DB_PASSWORD = secrets.DB_PASSWORD;
process.env.API_KEY_SECRET = secrets.API_KEY_SECRET;
process.env.JWT_SECRET = secrets.JWT_SECRET;
```

**Using Systems Manager Parameter Store:**

```bash
# Store secrets
aws ssm put-parameter \
    --name "/webscraper/prod/db-password" \
    --value "YOUR_PASSWORD" \
    --type "SecureString"

# Retrieve in application
aws ssm get-parameter \
    --name "/webscraper/prod/db-password" \
    --with-decryption
```

#### Heroku

```bash
# Set config vars
heroku config:set NODE_ENV=production
heroku config:set DB_PASSWORD=<your_password>
heroku config:set API_KEY_SECRET=<your_secret>
heroku config:set JWT_SECRET=<your_secret>
```

#### Docker

**Using Docker Secrets:**

```yaml
# docker-compose.yml
services:
  backend:
    image: webscraper-backend
    secrets:
      - db_password
      - api_key_secret
      - jwt_secret

secrets:
  db_password:
    external: true
  api_key_secret:
    external: true
  jwt_secret:
    external: true
```

#### Kubernetes

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: webscraper-secrets
type: Opaque
stringData:
  db-password: <base64_encoded>
  api-key-secret: <base64_encoded>
  jwt-secret: <base64_encoded>
```

---

## Secrets Rotation

### Rotation Schedule

| Secret | Frequency | Complexity |
|--------|-----------|------------|
| **DB_PASSWORD** | 90 days | High - requires rolling update |
| **API_KEY_SECRET** | 90 days | Medium - invalidates existing API keys |
| **JWT_SECRET** | 180 days | Medium - invalidates active sessions |

### Rotation Process

#### 1. Generate New Secret

```bash
node scripts/generate-secrets.js
# Or use your secrets manager
```

#### 2. Update Configuration

**Zero-downtime rotation (recommended):**
- Use dual-key validation (accept both old and new keys during transition)
- Update to new key
- Remove old key after grace period

**Simple rotation:**
- Schedule maintenance window
- Update secret
- Restart application
- Users re-authenticate

#### 3. Verify

```bash
# Test with new secrets
node scripts/validate-secrets.js

# Monitor for authentication errors
tail -f logs/combined.log | grep "authentication failed"
```

#### 4. Document

Document rotation in a secure location:
- Date rotated
- Reason for rotation (scheduled, compromised, etc.)
- Who performed rotation
- Any issues encountered

---

## Integration with Secret Managers

### AWS Secrets Manager

**Installation:**

```bash
npm install aws-sdk
```

**Implementation:**

```javascript
// config/secrets.js
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager({ region: 'us-east-1' });

async function loadSecrets() {
    if (process.env.NODE_ENV !== 'production') {
        return; // Use .env in development
    }
    
    const secretName = 'webscraper/production';
    const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
    const secrets = JSON.parse(data.SecretString);
    
    Object.assign(process.env, secrets);
}

module.exports = { loadSecrets };
```

**Usage in server.js:**

```javascript
const { loadSecrets } = require('./config/secrets');

(async () => {
    await loadSecrets();
    require('./config/environment'); // Now loads from env
    // ... start server
})();
```

### HashiCorp Vault

**Installation:**

```bash
npm install node-vault
```

**Implementation:**

```javascript
const vault = require('node-vault')({
    endpoint: process.env.VAULT_ADDR,
    token: process.env.VAULT_TOKEN
});

async function loadSecrets() {
    const result = await vault.read('secret/data/webscraper/production');
    Object.assign(process.env, result.data.data);
}
```

---

## Best Practices

### ✅ DO

- **Use a secrets manager in production** (AWS Secrets Manager, HashiCorp Vault)
- **Generate cryptographically random secrets** (32+ bytes)
- **Use different secrets per environment** (dev, staging, production)
- **Rotate secrets regularly** (every 90-180 days)
- **Validate secrets before deployment** (`validate-secrets.js`)
- **Keep secrets out of Git** (add `.env` to `.gitignore`)
- **Use environment variables** (never hardcode)
- **Limit access to production secrets** (principle of least privilege)
- **Audit secret access** (who accessed when)
- **Have a rotation plan** (documented and tested)

### ❌ DON'T

- **Never commit secrets to Git** (even in private repos)
- **Never share secrets via email/Slack** (use secure channels)
- **Never reuse secrets across environments**
- **Never use weak or predictable secrets**
- **Never log secrets** (even in debug mode)
- **Never store secrets in application code**
- **Never use default/example values in production**
- **Never give everyone access to production secrets**

---

## Secrets in CI/CD

### GitHub Actions

Store secrets in repository settings:

1. Go to Settings → Secrets and variables → Actions
2. Add secrets:
   - `DB_PASSWORD`
   - `API_KEY_SECRET`
   - `JWT_SECRET`
   - (Any other environment-specific vars)

**Usage in workflow:**

```yaml
env:
  DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
  API_KEY_SECRET: ${{ secrets.API_KEY_SECRET }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

See `.github/secrets-setup.md` for detailed instructions.

---

## Troubleshooting

### Validation Fails

**Problem:** `validate-secrets.js` reports errors

**Solutions:**
1. Check `.env` file exists
2. Verify all required variables are set
3. Regenerate weak secrets using `generate-secrets.js`
4. Ensure no default values remain

### Authentication Errors

**Problem:** "Invalid API key" or "JWT verification failed"

**Solutions:**
1. Verify secrets match between server and configuration
2. Check secrets weren't corrupted during copy/paste
3. Ensure no extra whitespace in secrets
4. Regenerate and update if necessary

### Database Connection Fails

**Problem:** "Password authentication failed"

**Solutions:**
1. Verify `DB_PASSWORD` is correct
2. Check database user has proper permissions
3. Ensure password doesn't contain special characters that need escaping
4. Test connection with `psql` command

---

## Emergency Procedures

### Secret Compromise

If a secret is compromised:

1. **Immediately rotate the secret**
2. **Audit access logs** to identify scope of compromise
3. **Invalidate all sessions** (for JWT_SECRET)
4. **Revoke all API keys** (for API_KEY_SECRET)
5. **Notify stakeholders**
6. **Document incident**
7. **Review and improve security practices**

### Lost Secrets

If secrets are lost:

1. **Do NOT deploy** until secrets are recovered or regenerated
2. **Check backup systems** (secrets manager, secure notes)
3. **If unrecoverable:** Generate new secrets and follow rotation procedure
4. **Update documentation** with recovery procedure

---

## Support

For questions or issues:

1. Review this documentation
2. Check application logs for specific error messages
3. Run `validate-secrets.js` for configuration issues
4. Contact your team's security lead for production secret access

---

## References

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [The Twelve-Factor App: Config](https://12factor.net/config)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
