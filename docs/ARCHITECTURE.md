# WebScraper System Architecture

## Table of Contents
- [System Overview](#system-overview)
- [Component Architecture](#component-architecture)
- [Sequence Diagrams](#sequence-diagrams)
- [Data Flow](#data-flow)
- [Deployment Architecture](#deployment-architecture)

---

## System Overview

The WebScraper is a full-stack application that enables real-time web scraping of e-commerce platforms through a WebSocket-based interface.

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React Frontend<br/>Port 3000]
    end
    
    subgraph "Application Layer"
        API[Express API<br/>Port 5000]
        WS[WebSocket Server<br/>Port 5000]
        
        subgraph "Services"
            BP[BrowserPool]
            SM[SessionManager]
            MS[MetricsService]
        end
        
        subgraph "Middleware"
            Auth[Authentication]
            Valid[Validation]
            RL[Rate Limiter]
        end
        
        subgraph "Scrapers"
            ZS[Zepto Scraper]
            BS[Blinkit Scraper]
        end
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL<br/>Database)]
    end
    
    subgraph "Browser Layer"
        PUP1[Puppeteer<br/>Browser 1]
        PUP2[Puppeteer<br/>Browser 2]
        PUPN[Puppeteer<br/>Browser N]
    end
    
    subgraph "External Services"
        Zepto[Zepto.com]
        Blinkit[Blinkit.com]
    end
    
    subgraph "Monitoring"
        Prom[Prometheus<br/>Port 9090]
        Graf[Grafana<br/>Port 3000]
    end
    
    UI <-->|HTTP/WS| API
    UI <-->|WebSocket| WS
    
    API --> Auth
    API --> Valid
    API --> RL
    WS --> Auth
    WS --> Valid
    WS --> RL
    
    WS --> SM
    WS --> BP
    WS --> MS
    
    SM --> DB
    BP --> PUP1
    BP --> PUP2
    BP --> PUPN
    
    ZS --> PUP1
    BS --> PUP2
    
    PUP1 -->|Scrape| Zepto
    PUP2 -->|Scrape| Blinkit
    
    API -->|/metrics| Prom
    MS --> Prom
    Prom --> Graf
    
    style UI fill:#61dafb
    style API fill:#68a063
    style WS fill:#68a063
    style DB fill:#336791
    style Prom fill:#e6522c
    style Graf fill:#f46800
```

### Key Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | React | User interface for scraping operations |
| **Backend** | Express.js + WebSocket | API and real-time communication |
| **Database** | PostgreSQL | Session and data persistence |
| **Browser Pool** | Puppeteer | Managed browser instances |
| **Monitoring** | Prometheus + Grafana | Metrics and visualization |

---

## Component Architecture

### Backend Component Breakdown

```mermaid
graph LR
    subgraph "Entry Point"
        Server[server.js]
    end
    
    subgraph "HTTP Layer"
        Routes[Routes]
        Middleware[Middleware Stack]
    end
    
    subgraph "WebSocket Layer"
        WSConn[connection.js]
        WSHandlers[WebSocket Handlers]
        
        subgraph "Handlers"
            InitH[initialization.js]
            LocH[location.js]
            SearchH[search.js]
            CatH[category.js]
        end
    end
    
    subgraph "Core Services"
        BrowserPool[BrowserPool.js]
        SessionMgr[SessionManager.js]
        MetricsSvc[MetricsService.js]
    end
    
    subgraph "Scraper Modules"
        ZeptoScraper[zepto/categoryScraper.js]
        ZeptoSearch[zepto/searchHelpers.js]
        BlinkitScraper[blinkit/categoryScraper.js]
        BlinkitSearch[blinkit/searchHelpers.js]
    end
    
    subgraph "Utilities"
        Logger[logger.js]
        Timeout[timeout.js]
        Validation[Joi Schemas]
    end
    
    subgraph "Database"
        Models[Models]
        Session[Session Model]
        Quotation[Quotation Model]
    end
    
    Server --> Routes
    Server --> WSConn
    Server --> Middleware
    
    Routes --> Middleware
    WSConn --> WSHandlers
    WSHandlers --> InitH
    WSHandlers --> LocH
    WSHandlers --> SearchH
    WSHandlers --> CatH
    
    InitH --> BrowserPool
    SearchH --> BrowserPool
    CatH --> BrowserPool
    
    WSConn --> SessionMgr
    BrowserPool --> MetricsSvc
    WSConn --> MetricsSvc
    
    CatH --> ZeptoScraper
    CatH --> BlinkitScraper
    SearchH --> ZeptoSearch
    SearchH --> BlinkitSearch
    
    SessionMgr --> Session
    
    BrowserPool --> Logger
    CatH --> Timeout
    SearchH --> Timeout
    
    style Server fill:#ff6b6b
    style BrowserPool fill:#4ecdc4
    style SessionMgr fill:#4ecdc4
    style MetricsSvc fill:#4ecdc4
```

### Service Responsibilities

#### BrowserPool
- Manages Puppeteer browser instances
- Enforces resource limits (10 total, 2 per user)
- Tracks browser lifecycle and TTL
- Provides browser statistics

#### SessionManager
- Manages WebSocket session state
- Tracks location settings per service
- Persists session data to database
- Provides active session count

#### MetricsService
- Collects Prometheus metrics
- Tracks scraping operations
- Monitors browser pool utilization
- Records WebSocket connections

---

## Sequence Diagrams

### 1. WebSocket Connection Flow

```mermaid
sequenceDiagram
    participant Client
    participant WSConn as WebSocket Handler
    participant Auth as Authentication
    participant RL as Rate Limiter
    participant SM as SessionManager
    participant DB as Database
    participant Metrics as MetricsService
    
    Client->>WSConn: Connect WebSocket
    WSConn->>Auth: Authenticate(req)
    Auth-->>WSConn: auth result
    
    alt Authentication Failed (Production)
        WSConn->>Metrics: recordWebSocketConnection(false)
        WSConn->>Client: Close(1008, "Auth failed")
    else Authentication Success or Dev Mode
        WSConn->>RL: checkRateLimit(ip, 'connect')
        RL-->>WSConn: allowed
        
        alt Rate Limit Exceeded
            WSConn->>Metrics: recordWebSocketConnection(false)
            WSConn->>Client: Close(1008, "Rate limit")
        else Rate Limit OK
            WSConn->>SM: createSession(cid, apiKey, ip, userAgent)
            SM->>DB: INSERT session
            DB-->>SM: success
            SM-->>WSConn: session created
            
            WSConn->>Metrics: recordWebSocketConnection(true)
            WSConn->>Metrics: updateActiveSessions(count)
            WSConn->>Client: {type: 'connected', cid}
            
            Note over Client,WSConn: Connection established
        end
    end
```

### 2. Category Scraping Flow

```mermaid
sequenceDiagram
    participant Client
    participant Handler as category.js
    participant BP as BrowserPool
    participant Metrics as MetricsService
    participant Scraper as categoryScraper
    participant Puppeteer
    participant Target as Target Website
    
    Client->>Handler: scrapeCategories {service, categories}
    Handler->>Metrics: recordScrapingRequest(service, 'category')
    Handler->>Metrics: Start duration timer
    
    Handler->>BP: getOrInitBrowser(cid, service)
    
    alt Browser Limit Reached
        BP->>Metrics: Browser limit check
        BP-->>Handler: Error(BROWSER_LIMIT_*)
        Handler->>Metrics: recordScrapingFailure(service, 'category', 'browser_limit')
        Handler->>Client: Error: Browser limit reached
    else Browser Available
        BP->>Puppeteer: Launch/reuse browser
        BP->>Metrics: recordBrowserInit(service)
        BP->>Metrics: updateBrowserPoolMetrics(stats)
        Puppeteer-->>BP: {browser, page}
        BP-->>Handler: {browser, page}
        
        Handler->>Scraper: scrapeCategories(page, categories)
        
        rect rgb(240, 240, 240)
            Note over Scraper,Target: Wrapped with 5-minute timeout
            loop For each category
                Scraper->>Puppeteer: Navigate to category
                Puppeteer->>Target: GET category page
                Target-->>Puppeteer: HTML response
                Puppeteer->>Scraper: Page loaded
                Scraper->>Puppeteer: Extract product data
                Puppeteer-->>Scraper: Products array
            end
        end
        
        alt Timeout Exceeded
            Handler->>BP: closeBrowser(cid, service)
            Handler->>Metrics: recordScrapingFailure(service, 'category', 'timeout')
            Handler->>Client: Error: Timeout after 5 minutes
        else Success
            Scraper-->>Handler: allProducts[]
            Handler->>Client: {status: 'completed', products, excelData}
            Handler->>Metrics: recordScrapingSuccess(service, 'category', timer)
        end
    end
```

### 3. Search Flow

```mermaid
sequenceDiagram
    participant Client
    participant Handler as search.js
    participant BP as BrowserPool
    participant Metrics as MetricsService
    participant SearchHelper
    participant Puppeteer
    participant Target as Target Website
    
    Client->>Handler: search {searchTerm, services[]}
    
    par For each service
        Handler->>Metrics: recordScrapingRequest(service, 'search')
        Handler->>BP: getOrInitBrowser(cid, service)
        BP-->>Handler: {browser, page}
        
        rect rgb(240, 240, 240)
            Note over Handler,Target: Wrapped with 2-minute timeout
            Handler->>SearchHelper: search(page, searchTerm)
            SearchHelper->>Puppeteer: Type search term
            Puppeteer->>Target: Submit search
            Target-->>Puppeteer: Search results
            SearchHelper->>Puppeteer: Extract products
            Puppeteer-->>SearchHelper: products[]
            SearchHelper-->>Handler: products[]
        end
        
        alt Success
            Handler->>Client: {service, status: 'completed', products}
            Handler->>Metrics: recordScrapingSuccess(service, 'search', timer)
        else Timeout or Error
            Handler->>Metrics: recordScrapingFailure(service, 'search', reason)
            Handler->>Client: {service, status: 'error', message}
        end
    end
```

### 4. Browser Lifecycle

```mermaid
sequenceDiagram
    participant Client
    participant BP as BrowserPool
    participant Puppeteer
    participant Metrics
    participant Cleanup as TTL Checker
    
    Client->>BP: getOrInitBrowser(cid, service)
    
    BP->>BP: Check limits
    alt Limit exceeded
        BP-->>Client: Error(BROWSER_LIMIT_*)
    else Limit OK
        BP->>BP: Check existing browser
        
        alt Browser exists
            BP->>BP: Update lastUsed timestamp
            BP-->>Client: {browser, page}
        else No browser
            BP->>Metrics: recordBrowserInit(service)
            BP->>Puppeteer: launch()
            Puppeteer-->>BP: browser instance
            BP->>Puppeteer: newPage()
            Puppeteer-->>BP: page instance
            BP->>Metrics: Update browser pool metrics
            BP-->>Client: {browser, page}
        end
    end
    
    Note over Cleanup: Periodic TTL check (every minute)
    
    loop Every 60 seconds
        Cleanup->>BP: Check TTL for all browsers
        BP->>BP: Find browsers older than TTL (5 min)
        alt Browser expired
            BP->>Puppeteer: close()
            Puppeteer-->>BP: closed
            BP->>Metrics: updateBrowserPoolMetrics(stats)
        end
    end
    
    Client->>BP: closeBrowser(cid, service)
    BP->>Puppeteer: close()
    Puppeteer-->>BP: closed
    BP->>BP: Remove from pool
    BP->>Metrics: updateBrowserPoolMetrics(stats)
```

---

## Data Flow

### Request Flow

```mermaid
flowchart TD
    Start([Client Request])
    
    Start --> WebSocket{Request Type}
    
    WebSocket -->|Initialize| Init[Initialize Browser]
    WebSocket -->|SetLocation| Loc[Set Location Cookie]
    WebSocket -->|Search| Search[Search Products]
    WebSocket -->|Scrape| Scrape[Scrape Categories]
    
    Init --> AuthCheck{Authenticated?}
    Search --> AuthCheck
    Scrape --> AuthCheck
    Loc --> AuthCheck
    
    AuthCheck -->|No & Prod| Reject[Reject Connection]
    AuthCheck -->|Yes or Dev| RateCheck{Rate Limit OK?}
    
    RateCheck -->|No| Reject
    RateCheck -->|Yes| ValidCheck{Valid Request?}
    
    ValidCheck -->|No| Error[Return Error]
    ValidCheck -->|Yes| BrowserCheck{Browser Available?}
    
    BrowserCheck -->|Limit Reached| LimitError[Browser Limit Error]
    BrowserCheck -->|Available| GetBrowser[Get/Launch Browser]
    
    GetBrowser --> Execute[Execute Scraping]
    Execute --> TimeoutCheck{Within Timeout?}
    
    TimeoutCheck -->|No| TimeoutError[Timeout Error]
    TimeoutCheck -->|Yes| Success[Return Results]
    
    Success --> Metrics[Record Metrics]
    Error --> Metrics
    LimitError --> Metrics
    TimeoutError --> Metrics
    Reject --> Metrics
    
    Metrics --> End([Response to Client])
    
    style Start fill:#90EE90
    style End fill:#90EE90
    style Reject fill:#FF6B6B
    style Error fill:#FFD93D
    style LimitError fill:#FFD93D
    style TimeoutError fill:#FFD93D
    style Success fill:#6BCF7F
```

### State Management

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    
    Disconnected --> Connecting: Client connects
    Connecting --> Connected: Auth + Rate limit OK
    Connecting --> Disconnected: Auth/Rate limit failed
    
    Connected --> BrowserInitializing: Initialize request
    BrowserInitializing --> BrowserReady: Browser launched
    BrowserInitializing --> Connected: Browser limit error
    
    BrowserReady --> Scraping: Scrape/Search request
    Scraping --> BrowserReady: Operation complete
    Scraping --> BrowserReady: Operation timeout
    Scraping --> BrowserReady: Operation error
    
    BrowserReady --> BrowserClosed: Close browser / TTL expired
    BrowserClosed --> Connected: Browser cleaned up
    
    Connected --> Disconnected: Client disconnect
    BrowserReady --> Disconnected: Client disconnect
    Scraping --> Disconnected: Client disconnect (cleanup)
```

---

## Deployment Architecture

### Development Environment

```mermaid
graph TB
    subgraph "Developer Machine"
        subgraph "Frontend Dev Server"
            ReactDev[React Dev Server<br/>localhost:3000]
        end
        
        subgraph "Backend Dev Server"
            NodeDev[Node.js<br/>localhost:5000]
            Browsers[Puppeteer Browsers]
        end
        
        subgraph "Database"
            PostgresDev[PostgreSQL<br/>localhost:5432]
        end
        
        subgraph "Monitoring (Optional)"
            PromDev[Prometheus<br/>localhost:9090]
            GrafDev[Grafana<br/>localhost:3000]
        end
    end
    
    ReactDev <--> NodeDev
    NodeDev --> PostgresDev
    NodeDev --> Browsers
    NodeDev -->|/metrics| PromDev
    PromDev --> GrafDev
    
    style ReactDev fill:#61dafb
    style NodeDev fill:#68a063
    style PostgresDev fill:#336791
```

### Production Environment

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Nginx / Load Balancer]
    end
    
    subgraph "Frontend Tier"
        FE1[React App<br/>Container 1]
        FE2[React App<br/>Container 2]
    end
    
    subgraph "Backend Tier"
        BE1[Node.js API<br/>Container 1]
        BE2[Node.js API<br/>Container 2]
        BE3[Node.js API<br/>Container 3]
    end
    
    subgraph "Database Tier"
        DBPrimary[(PostgreSQL<br/>Primary)]
        DBReplica[(PostgreSQL<br/>Replica)]
    end
    
    subgraph "Monitoring Tier"
        Prometheus[Prometheus<br/>Container]
        Grafana[Grafana<br/>Container]
        AlertMgr[AlertManager]
    end
    
    Internet([Internet]) --> LB
    LB --> FE1
    LB --> FE2
    LB --> BE1
    LB --> BE2
    LB --> BE3
    
    FE1 --> BE1
    FE2 --> BE2
    
    BE1 --> DBPrimary
    BE2 --> DBPrimary
    BE3 --> DBPrimary
    
    DBPrimary -.->|Replication| DBReplica
    
    BE1 -->|/metrics| Prometheus
    BE2 -->|/metrics| Prometheus
    BE3 -->|/metrics| Prometheus
    
    Prometheus --> Grafana
    Prometheus --> AlertMgr
    
    style LB fill:#f39c12
    style DBPrimary fill:#336791
    style DBReplica fill:#5a7fa1
    style Prometheus fill:#e6522c
    style Grafana fill:#f46800
```

### Container Architecture

```mermaid
graph LR
    subgraph "Docker Host"
        subgraph "Frontend Container"
            Nginx[Nginx]
            ReactBuild[React Build]
        end
        
        subgraph "Backend Container"
            Node[Node.js]
            Chromium[Chromium<br/>for Puppeteer]
        end
        
        subgraph "Database Container"
            PG[PostgreSQL]
            PGData[/data volume/]
        end
        
        subgraph "Monitoring Containers"
            Prom[Prometheus]
            Graf[Grafana]
        end
    end
    
    Nginx --> ReactBuild
    Node --> Chromium
    PG --> PGData
    
    ReactBuild -.->|HTTP| Node
    Node -.->|SQL| PG
    Node -.->|metrics| Prom
    Prom -.->|data| Graf
```

---

## Technology Stack

### Frontend
- **Framework**: React 18
- **HTTP Client**: Axios
- **WebSocket Client**: Native WebSocket API
- **Build Tool**: Vite / Create React App

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4
- **WebSocket**: ws library
- **Browser Automation**: Puppeteer
- **Database ORM**: pg (node-postgres)
- **Validation**: Joi
- **Logging**: Winston
- **Metrics**: prom-client

### Database
- **RDBMS**: PostgreSQL 14+
- **Connection Pooling**: pg Pool

### DevOps
- **Containerization**: Docker
- **Orchestration**: Docker Compose (dev), Kubernetes (prod option)
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana

---

## Security Architecture

```mermaid
flowchart TD
    subgraph "Security Layers"
        direction TB
        
        L1[Layer 1: Network<br/>- HTTPS/WSS<br/>- Rate Limiting]
        L2[Layer 2: Authentication<br/>- API Keys<br/>- JWT Tokens]
        L3[Layer 3: Authorization<br/>- Session Validation<br/>- Resource Limits]
        L4[Layer 4: Input Validation<br/>- Joi Schemas<br/>- XSS Prevention]
        L5[Layer 5: Application<br/>- Helmet Headers<br/>- CORS Policy]
        L6[Layer 6: Monitoring<br/>- Metrics<br/>- Logging]
    end
    
    Request([Incoming Request]) --> L1
    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 --> L5
    L5 --> L6
    L6 --> App[Application Logic]
    
    style Request fill:#ff6b6b
    style App fill:#51cf66
```

### Security Measures

| Layer | Mechanism | Implementation |
|-------|-----------|----------------|
| **Transport** | HTTPS/WSS | TLS 1.2+ |
| **Authentication** | API Keys | Header-based auth |
| **Rate Limiting** | Token bucket | Per IP limits |
| **Input Validation** | Schema validation | Joi middleware |
| **Output Encoding** | XSS prevention | Sanitization |
| **Headers** | Security headers | Helmet middleware |
| **Secrets** | Environment variables | .env files |

---

## Performance Considerations

### Resource Limits

| Resource | Limit | Rationale |
|----------|-------|-----------|
| Total browsers | 10 | Prevent memory exhaustion |
| Browsers per user | 2 | Fair resource allocation |
| WebSocket connections | Rate limited | Prevent DoS |
| Scraping timeout | 5 minutes | Prevent indefinite hangs |
| Search timeout | 2 minutes | Quick feedback |
| Browser TTL | 5 minutes | Balance reuse vs memory |

### Scalability

- **Horizontal Scaling**: Multiple backend instances behind load balancer
- **Session Affinity**: Sticky sessions for WebSocket connections
- **Database Connection Pooling**: Reuse connections efficiently
- **Browser Pool Per Instance**: Each backend manages its own pool
- **Metrics Aggregation**: Prometheus scrapes all instances

---

## Future Enhancements

1. **Queue System**: Add Redis-based job queue for scraping requests
2. **Caching**: Cache frequently-scraped categories
3. **Multi-region**: Deploy in multiple regions for lower latency
4. **Auto-scaling**: Scale based on browser pool utilization
5. **Advanced Monitoring**: APM integration (DataDog, New Relic)
6. **Database Sharding**: Partition data for better performance
