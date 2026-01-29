import { useState, useEffect, useRef, useCallback } from 'react';
import { getWebsocketUrl } from '../utils/websocket';
import type { WebSocketMessage } from '../types';
import { toast } from 'react-hot-toast';

interface UseWebSocketOptions {
    onMessage?: (data: WebSocketMessage) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Event) => void;
    debug?: boolean;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const ws = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
    // Prevent infinite reconnect loop if completely offline
    const reconnectAttempts = useRef(0);
    const MAX_RECONNECT_ATTEMPTS = 5;

    // Use refs for callbacks to avoid re-triggering connect on render
    const onConnectRef = useRef(options.onConnect);
    const onDisconnectRef = useRef(options.onDisconnect);
    const onMessageRef = useRef(options.onMessage);
    const onErrorRef = useRef(options.onError);

    useEffect(() => {
        onConnectRef.current = options.onConnect;
        onDisconnectRef.current = options.onDisconnect;
        onMessageRef.current = options.onMessage;
        onErrorRef.current = options.onError;
    }, [options.onConnect, options.onDisconnect, options.onMessage, options.onError]);

    const connect = useCallback(() => {
        try {
            const url = getWebsocketUrl();
            if (options.debug) console.log('Connecting to WebSocket:', url);

            // Close existing connection if any (though useEffect cleanup handles this mostly)
            if (ws.current && (ws.current.readyState === WebSocket.CONNECTING || ws.current.readyState === WebSocket.OPEN)) {
                return; // Already connecting or connected
            }

            ws.current = new WebSocket(url);

            ws.current.onopen = () => {
                if (options.debug) console.log('WebSocket Connected');
                setIsConnected(true);
                setError(null);

                // Only reset attempts after connection stays open for 1s (prevents flapping loops)
                setTimeout(() => {
                    if (ws.current?.readyState === WebSocket.OPEN) {
                        reconnectAttempts.current = 0;
                    }
                }, 1000);

                onConnectRef.current?.();

                // Initial handshake if needed
                ws.current?.send(JSON.stringify({ action: 'initialize', debug: options.debug }));
            };

            ws.current.onclose = (event) => {
                if (options.debug) console.log('WebSocket Disconnected', event);
                setIsConnected(false);
                onDisconnectRef.current?.();

                // Check for fatal close codes (Auth failure, etc.)
                if (event.code >= 4000 && event.code < 4010) {
                    const reason = event.reason || "Authentication failed";
                    console.error(`WebSocket connection rejected: ${reason} (Code: ${event.code})`);
                    setError(reason);
                    toast.error(`Connection rejected: ${reason}`);
                    return; // Do NOT reconnect
                }

                // Attempt reconnect if not clean close
                if (!event.wasClean && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
                    reconnectAttempts.current++;
                    if (options.debug) console.log(`Reconnecting in ${delay}ms... (Attempt ${reconnectAttempts.current})`);

                    reconnectTimeout.current = setTimeout(() => {
                        connect();
                    }, delay);
                } else if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
                    setError("Connection failed after multiple attempts.");
                    toast.error("Connection lost. Please refresh the page.");
                }
            };

            ws.current.onerror = (event) => {
                console.error('WebSocket Error:', event);
                setError("Connection error");
                onErrorRef.current?.(event);
            };

            ws.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (options.debug) console.log('WebSocket Message:', data);
                    onMessageRef.current?.(data);
                } catch {
                    console.error('Failed to parse WebSocket message:', event.data);
                }
            };

        } catch (e) {
            console.error('WebSocket Connection Failed:', e);
            setError("Failed to create connection");
            setIsConnected(false);
        }
    }, [options.debug]); // Depend only on stable primitive options

    useEffect(() => {
        connect();

        return () => {
            if (ws.current) {
                ws.current.close();
            }
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
            }
        };
    }, [connect]);

    const sendMessage = useCallback((data: any) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(data));
            return true;
        } else {
            console.warn('Cannot send message, WebSocket not connected');
            toast.error("Not connected to server");
            return false;
        }
    }, []);

    return {
        isConnected,
        error,
        sendMessage,
        ws: ws.current // Exposed for legacy compatibility if needed
    };
};
