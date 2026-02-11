# WebScraper Monitoring Guide

## Overview

The WebScraper application uses **Prometheus** for metrics collection and **Grafana** for visualization. This provides real-time insights into system performance, resource usage, and operational health.

## Available Metrics

### Scraping Metrics

- **`scraping_requests_total`** (Counter): Total number of scraping requests by service and type
- **`scraping_success_total`** (Counter): Successful scraping operations
- **`scraping_failures_total`** (Counter): Failed operations with failure reason (timeout, browser_limit, error)
- **`scraping_duration_seconds`** (Histogram): Duration of scraping operations in seconds

### Browser Pool Metrics

- **`active_browsers`** (Gauge): Number of currently active browser instances
- **`browser_pool_utilization_percent`** (Gauge): Browser pool utilization percentage
- **`browser_initializations_total`** (Counter): Total browser initializations by service
- **`browser_init_duration_seconds`** (Histogram): Browser initialization duration

### WebSocket Metrics

- **`websocket_connections_total`** (Counter): Total WebSocket connections (accepted/rejected)
- **`active_sessions`** (Gauge): Number of active WebSocket sessions

### System Metrics

Default Node.js metrics are also collected:
- CPU usage
- Memory usage (heap, RSS, external)
- Event loop lag
- Garbage collection stats

## Setup Instructions

### 1. Prometheus Setup

#### Using Docker

```bash
# Create a docker-compose.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
```

#### Manual Installation

1. Download Prometheus from https://prometheus.io/download/
2. Copy `config/prometheus.yml` to your Prometheus directory
3. Start Prometheus:
   ```bash
   ./prometheus --config.file=prometheus.yml
   ```

### 2. Grafana Setup

#### Using Docker

```bash
docker run -d \
  --name=grafana \
  -p 3000:3000 \
  grafana/grafana:latest
```

#### Manual Installation

1. Download Grafana from https://grafana.com/grafana/download
2. Start Grafana service
3. Access Grafana at http://localhost:3000 (default login: admin/admin)

### 3. Configure Grafana

1. Add Prometheus as a data source:
   - Name: `prometheus`
   - URL: `http://localhost:9090`
   - Save & Test

2. Import the dashboard:
   - Go to Dashboards → Import
   - Upload `config/grafana-dashboard.json`
   - Select the prometheus data source

## Dashboard Panels

The default dashboard includes:

1. **Browser Pool Utilization** (Gauge): Shows current browser pool usage percentage
2. **Active Resources** (Time series): Tracks active browsers and sessions over time
3. **Scraping Request Rate** (Time series): Requests per second by service and type
4. **Scraping Success vs Failures** (Stacked time series): Success/failure rates with failure reasons
5. **Scraping Duration Percentiles** (Time series): p50, p95, p99 latencies

## Accessing Metrics

### /metrics Endpoint

The backend exposes metrics at `http://localhost:5000/metrics` in Prometheus format.

Example:
```bash
curl http://localhost:5000/metrics
```

### /api/stats Endpoint

Real-time browser pool statistics are available at `http://localhost:5000/api/stats`:

```json
{
  "browserPool": {
    "totalBrowsers": 5,
    "maxBrowsers": 10,
    "utilizationPercent": 50,
    "perServiceBrowsers": {
      "zepto": 3,
      "blinkit": 2
    },
    "perUserBrowsers": {
      "user123": 2,
      "user456": 3
    }
  },
  "timestamp": "2026-02-10T14:30:00.000Z"
}
```

## Alerting

### Recommended Alerts

Configure these alerts in Prometheus:

1. **High Browser Pool Utilization**
   ```yaml
   - alert: HighBrowserPoolUtilization
     expr: browser_pool_utilization_percent > 80
     for: 5m
     annotations:
       summary: "Browser pool utilization above 80%"
   ```

2. **High Failure Rate**
   ```yaml
   - alert: HighScrapingFailureRate
     expr: rate(scraping_failures_total[5m]) / rate(scraping_requests_total[5m]) > 0.1
     for: 5m
     annotations:
       summary: "Scraping failure rate above 10%"
   ```

3. **Timeout Issues**
   ```yaml
   - alert: FrequentTimeouts
     expr: rate(scraping_failures_total{reason="timeout"}[5m]) > 0.5
     for: 5m
     annotations:
       summary: "Frequent timeout errors detected"
   ```

## Troubleshooting

### Metrics Not Appearing

1. Verify backend is running and accessible
2. Check Prometheus is scraping: http://localhost:9090/targets
3. Verify `/metrics` endpoint is accessible
4. Check Prometheus logs for errors

### Dashboard Not Updating

1. Verify Prometheus data source connection in Grafana
2. Check time range selector in dashboard
3. Verify queries are valid for your Prometheus version

### High Memory Usage

If metrics collection causes high memory:
1. Reduce scrape frequency in `prometheus.yml`
2. Reduce metric retention period
3. Reduce histogram bucket counts in `MetricsService.js`

## Production Considerations

1. **Security**: Protect `/metrics` endpoint with authentication in production
2. **Retention**: Configure appropriate retention policies in Prometheus
3. **Sizing**: Plan Prometheus storage based on expected metrics volume
4. **High Availability**: Consider Prometheus clustering for production
5. **Backup**: Regularly backup Grafana dashboards and configurations

## Next Steps

- Add custom alerts based on your SLAs
- Create additional dashboards for specific use cases
- Integrate with alerting systems (PagerDuty, Slack, etc.)
- Set up long-term metrics storage (Thanos, Cortex)
