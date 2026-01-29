export const getWebsocketUrl = () => {
    const isProduction = import.meta.env.PROD;
    const apiKey = import.meta.env.VITE_API_KEY;

    // In development, VITE_API_KEY might be in .env.local
    // In production, it should be set in environment variables

    let baseUrl;
    if (import.meta.env.VITE_WS_URL) {
        baseUrl = import.meta.env.VITE_WS_URL;
    } else if (isProduction && typeof window !== "undefined") {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        baseUrl = `${protocol}//${window.location.host}`;
    } else {
        baseUrl = "ws://localhost:5000";
    }

    if (apiKey) {
        return `${baseUrl}?apiKey=${apiKey}`;
    }

    return baseUrl;
}
