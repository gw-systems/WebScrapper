# Security Documentation

## Overview

This document outlines the security measures implemented in the WebScraper application, including authentication, authorization, rate limiting, input validation, and secure configuration practices.

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [API Keys Management](#api-keys-management)
3. [Rate Limiting](#rate-limiting)
4. [Input Validation](#input-validation)
5. [Security Headers](#security-headers)
6. [CORS Policy](#cors-policy)
7. [Secrets Management](#secrets-management)
8. [Security Best Practices](#security-best-practices)
9. [Incident Response](#incident-response)

---

## Authentication & Authorization

### WebSocket Authentication

**Production Mode:**
- API key authentication is **mandatory**
- Connections without valid API keys are rejected with error code `1008`
- API key must be provided as query parameter: `ws://localhost:5000?apiKey=YOUR_KEY`

**Development Mode:**
- API key authentication is optional (logs warning if missing)
- Allows testing without database setup

### Implementation

```javascript
// Frontend WebSocket connection example
const ws = new WebSocket(`ws://localhost:5000?apiKey=${API_KEY}`);
```

---

## API Keys Management

### Generating API Keys

1. **Generate New Secrets:**
   ```bash
   cd backend
   node scripts/generate-secrets.js
   ```

2. **Update `.env` File:**
   Copy the generated `API_KEY_SECRET` and `JWT_SECRET` to `backend/.env`

3. **Seed Database:**
   ```bash
   psql -U webscrapper_user -d webscraper -f database/seeds/dev_api_keys.sql
   ```

### Database Structure

API keys are stored in the `api_keys` table:
- `key`: UUID v4 format
- `name`: Descriptive name
- `is_active`: Enable/disable without deleting
- `last_used_at`: Track usage
- `created_at`: Audit trail

### Revoking API Keys

```sql
UPDATE api_keys SET is_active = false WHERE key = 'KEY_TO_REVOKE';
```

---

## Rate Limiting

### HTTP Rate Limits (API Endpoints)

| Endpoint | Limit | Window |
|----------|-------|--------|
| Global `/api/*` | 100 requests | 15 minutes |
| `/api/instamart/scrape` | 5 requests | 1 hour |
| Read endpoints | 200 requests | 15 minutes |

**Response on Rate Limit:**
- HTTP Status: `429 Too Many Requests`
- Headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`
- Body: `{ "success": false, "error": "...", "retryAfter": <seconds> }`

### WebSocket Rate Limits

| Action | Limit | Window |
|--------|-------|--------|
| Connections | 100 per IP | 1 minute |
| Messages | 300 per IP | 1 minute |

**Response on Rate Limit:**
- Connection closed with code `1008`
- Error message: "Rate limit exceeded"

### Configuration

Rate limits are configured in `backend/.env`:
```env
MAX_CONNECTIONS_PER_IP=100
MAX_MESSAGES_PER_MINUTE=300
RATE_LIMIT_WINDOW_MS=60000
```

---

## Input Validation

### Validation Library

Using **Joi** for schema-based validation with:
- Type checking
- Length constraints
- Pattern matching (regex)
- Custom error messages
- Automatic sanitization

### Validated Inputs

**WebSocket Messages:**
- `action`: Must be one of: `initialize`, `setLocation`, `search`, `scrapeCategories`, `close-browser`
- `service`: Must be `zepto` or `blinkit`
- `location`: 2-200 chars, alphanumeric + basic punctuation only
- `search`: 1-100 chars
- `categories`: Array of max 50 items

**API Endpoints:**
- Query parameters: `category`, `search`, `limit` (1-1000), `offset`
- Body fields: Validated per endpoint

### Payload Size Limits

- HTTP JSON body: 1MB maximum
- WebSocket message: 100KB maximum

### Error Responses

```json
{
  "success": false,
  "error": "Validation failed: Location must be at least 2 characters; Service must be one of [zepto, blinkit]"
}
```

---

## Security Headers

Implemented using **Helmet.js** middleware.

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | Restrictive directives | Prevents XSS attacks |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS protection |
| `Strict-Transport-Security` | `max-age=15552000` | Enforces HTTPS |

### Content Security Policy

```javascript
defaultSrc: ["'self'"],
connectSrc: ["'self'", "http://localhost:5173"],
scriptSrc: ["'self'"],
styleSrc: ["'self'", "'unsafe-inline'"],
imgSrc: ["'self'", "data:", "https:"]
```

---

## CORS Policy

### Production

- **Allowed Origin:** Only `FRONTEND_URL` from `.env`
- **Blocked:** All other origins (logged)
- **Methods:** `GET`, `POST`, `PUT`, `DELETE`
- **Credentials:** Allowed

### Development

- **Allowed Origins:** Any `localhost` or `127.0.0.1` on any port
- **Permissive:** Allows testing from multiple sources

### Configuration

```env
FRONTEND_URL=https://yourdomain.com  # Production
FRONTEND_URL=http://localhost:5173   # Development
```

---

## Secrets Management

### Environment Variables

**NEVER commit `.env` files to version control!**

### Secret Requirements

- **Minimum Length:** 32 characters
- **Format:** Hex-encoded random bytes (64 chars recommended)
- **Generation:** Use `scripts/generate-secrets.js`

### Validation

On server startup, the application validates:
1. Required secrets are present
2. Secrets are not default/weak values
3. Minimum length requirements are met

**If validation fails in production:** Server will not start.

### Rotation

To rotate secrets:
1. Generate new secrets: `node scripts/generate-secrets.js`
2. Update `.env` file
3. Update database API keys
4. Restart server
5. Update frontend configuration

---

## Security Best Practices

### For Developers

1. **Never log sensitive data** (API keys, passwords, tokens)
2. **Use parameterized queries** for all database operations
3. **Validate all inputs** on both client and server
4. **Keep dependencies updated** (`npm audit fix`)
5. **Use HTTPS in production** (terminate SSL at proxy/load balancer)
6. **Enable logging** for security events
7. **Review logs regularly** for suspicious activity

### For Deployment

1. **Set `NODE_ENV=production`**
2. **Generate unique secrets** for each environment
3. **Use strong database passwords** (16+ chars, mixed case, symbols)
4. **Enable firewall** (only allow necessary ports)
5. **Use reverse proxy** (Nginx, Caddy) for SSL termination
6. **Implement backup strategy** for database
7. **Monitor server resources** (CPU, memory, disk)

### For Operations

1. **Regular security audits** (monthly)
2. **Monitor rate limit violations** (potential attacks)
3. **Review authentication failures** (brute force attempts)
4. **Update dependencies** (patch vulnerabilities)
5. **Backup database** (daily automated backups)
6. **Test disaster recovery** (quarterly)

---

## Incident Response

### Security Event Categories

**Critical:**
- Multiple failed authentication attempts from same IP
- SQL injection attempts detected
- DDoS attack (rate limits consistently exceeded)
- Unauthorized access to database

**Warning:**
- Single authentication failure
- Validation errors (malformed input)
- Rate limit exceeded (legitimate user)

**Info:**
- Successful authentication
- Normal rate limit usage

### Response Procedures

#### Suspected Attack

1. **Identify:** Check logs for patterns
   ```bash
   # View recent security events
   tail -f backend/logs/combined.log | grep -E "WARN|ERROR"
   ```

2. **Block:** Add IP to firewall if confirmed attack
   ```bash
   # Example using iptables
   sudo iptables -A INPUT -s <ATTACKER_IP> -j DROP
   ```

3. **Investigate:** Review full access logs
4. **Document:** Record incident details
5. **Patch:** Fix vulnerability if found

#### Data Breach

1. **Isolate:** Disconnect affected systems
2. **Assess:** Determine scope of breach
3. **Notify:** Inform affected users
4. **Remediate:** Patch vulnerabilities
5. **Restore:** From clean backup if needed
6. **Audit:** Full security review

### Emergency Contacts

- **Developer:** [Your contact]
- **System Admin:** [Admin contact]
- **Database Admin:** [DBA contact]

---

## Security Checklist

Use this checklist before deploying to production:

- [ ] All secrets generated using `generate-secrets.js`
- [ ] `.env` file not committed to Git
- [ ] `NODE_ENV=production` set
- [ ] Database password is strong (16+ characters)
- [ ] API keys seeded in database
- [ ] SSL/TLS configured (HTTPS)
- [ ] Firewall rules configured
- [ ] Rate limiting tested
- [ ] Input validation tested
- [ ] Authentication tested
- [ ] Logging configured and working
- [ ] Backup strategy in place
- [ ] Monitoring alerts configured
- [ ] Security headers verified (check with securityheaders.com)
- [ ] CORS policy tested
- [ ] Dependencies updated (`npm audit`)

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Joi Validation](https://joi.dev/api/)

---

**Last Updated:** 2026-02-10  
**Document Version:** 1.0  
**Maintained By:** Development Team
