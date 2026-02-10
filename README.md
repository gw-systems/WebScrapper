# Zepto-Blinkit Scraper

Zepto-Blinkit Scraper is a web application that helps you scrape product information across Blinkit and Zepto.

## Features

- **Specialized Category Scraping**: High-performance scraping for all categories on Zepto and Blinkit.
- **Location-based Results**: Set your location to get accurate price and delivery data.
- **Excel Export**: Download complete category data as `.xlsx` files for easy analysis.
- **Responsive Dashboard**: A clean, React-based UI for managing scraping tasks.
- **Headless Mode**: Efficient backend operation using headless Puppeteer.

## Project Structure

```
Zepto-Blinkit-Scraper/
├── backend/                   # Node.js backend server
│   ├── blinkit/               # Blinkit-specific scraping logic
│   ├── zepto/                 # Zepto-specific scraping logic
│   ├── services/              # Shared services (BrowserPool, SessionManager)
│   ├── websocket/             # WebSocket handlers for real-time communication
│   ├── server.js              # Main Express/WS server
│   └── package.json           # Backend dependencies
├── frontend/                  # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/        # UI components (Location, Categories, etc.)
│   │   ├── context/           # Global state management
│   │   ├── App.tsx            # Main application layout
│   │   └── main.tsx           # React entry point
│   └── package.json           # Frontend dependencies
└── README.md                  # Project documentation
```

## Technology Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **WebSocket** - Real-time communication
- **Puppeteer** - Web automation and scraping
- **dotenv** - Environment configuration

### Frontend
- **React** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Styling framework
- **shadcn/ui** - Component library
- **Vite** - Build tool

### Installation

1. **Clone the Repository:**
```bash
git clone https://github.com/yourusername/Zepto-Blinkit-Scraper.git
cd Zepto-Blinkit-Scraper
```

2. **Install Backend Dependencies:**
```bash
cd backend
npm install
```

3. **Install Frontend Dependencies:**
```bash
cd frontend
npm install
```

### Running the Application

1. **Start the Backend Server:**
```bash
cd backend
npm start
```
The backend will run on `http://localhost:5000`

2. **Start the Frontend Development Server:**
```bash
cd frontend
npm run dev
```
The frontend will run on `http://localhost:5173`

3. **Access the Dashboard:**
Open your browser and navigate to `http://localhost:5173`

## Deployment

### Environment Variables

#### Backend (.env)
Create a `backend/.env` file with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=webscraper
DB_USER=webscraper_user
DB_PASSWORD=dev_password_123
DB_POOL_MIN=2
DB_POOL_MAX=10

# Logging
LOG_LEVEL=info
```

#### Frontend (.env.local)
Create a `frontend/.env.local` file:

```env
# API Key for WebSocket authentication
VITE_API_KEY=your-api-key-here

# WebSocket URL (optional, defaults to same host)
VITE_WS_URL=ws://localhost:5000
```

### Docker Deployment

#### Using Docker Compose (Recommended)

1. **Start the database:**
```bash
docker-compose up -d postgres
```

2. **Verify database is running:**
```bash
docker ps
```

3. **Run database setup (first time only):**
```bash
# Windows
setup-database.bat

# Linux/Mac
psql -U postgres -d webscraper -f database/migrations/001_initial_schema.sql
psql -U postgres -d webscraper -f database/seeds/dev_api_keys.sql
```

#### Using Dockerfile

Build and run the application container:

```bash
# Build the image
docker build -t webscraper .

# Run the container
docker run -p 10000:10000 \
  -e DB_HOST=your-db-host \
  -e DB_NAME=webscraper \
  -e DB_USER=webscraper_user \
  -e DB_PASSWORD=your-password \
  webscraper
```

### Production Deployment

#### Prerequisites
- Node.js 20+ installed
- PostgreSQL 14+ database
- Chrome/Chromium browser (for Puppeteer)

#### Steps

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd WebScraper
cd backend && npm ci
cd ../frontend && npm ci
```

2. **Set up the database:**
```bash
# Create database and user
psql -U postgres -c "CREATE DATABASE webscraper;"
psql -U postgres -c "CREATE USER webscraper_user WITH ENCRYPTED PASSWORD 'your-password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE webscraper TO webscraper_user;"

# Run migrations
psql -U webscraper_user -d webscraper -f database/migrations/001_initial_schema.sql
psql -U webscraper_user -d webscraper -f database/seeds/dev_api_keys.sql
```

3. **Configure environment variables:**
- Create `backend/.env` with production values
- Create `frontend/.env.local` with production API key

4. **Build the frontend:**
```bash
cd frontend
npm run build
```

5. **Start the backend:**
```bash
cd backend
npm start
```

The application will serve the built frontend from `backend/public`.

#### Running Tests

```bash
# Backend integration tests
cd backend
npm test

# Run specific test suites
npm run test:integration
```

### Troubleshooting

**Database connection issues:**
- Verify PostgreSQL is running: `docker ps` or `Get-Service postgresql*`
- Check connection string in `backend/.env`
- Ensure database user has proper permissions

**WebSocket connection failures:**
- Check firewall settings
- Verify `VITE_WS_URL` matches your backend URL
- Check browser console for connection errors

**Puppeteer/Chrome issues:**
- Ensure Chrome is installed: `google-chrome-stable --version`
- Check `PUPPETEER_EXECUTABLE_PATH` environment variable
- Review Puppeteer logs in `backend/logs/`


## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Happy shopping and happy scraping! 🚀
