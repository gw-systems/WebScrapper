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

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Happy shopping and happy scraping! 🚀
