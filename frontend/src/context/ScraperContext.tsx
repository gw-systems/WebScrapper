import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import type { Service, WebSocketMessage, LocationResult, CategoryScrapeResult } from '../types';
import { toast } from 'react-hot-toast';

interface ServiceState {
    isScrapingCategories: boolean;
    categoryProgress: { current: number; total: number; categoryName: string; mainCategory: string };
    categoryResults: CategoryScrapeResult[];
    completedMainCategories: string[];
    totalMainCategories: number;
    excelFilePath: string | null;
    excelFileName: string | null;
    categorySearchTerm: string;
    products: any[]; // Search products
    isLoading: boolean; // Loading state for searches
}

interface ScraperContextType {
    isConnected: boolean;
    activeService: Service;
    setActiveService: (service: Service) => void;
    locationStatus: { isSet: boolean; isLoading: boolean; location: string };
    setLocationStatus: (status: any) => void;
    servicesState: Record<Service, ServiceState>;
    updateServiceState: (service: Service, updates: Partial<ServiceState>) => void;
    sendMessage: (data: any) => boolean;
    loadingMessage: string;
    setLoadingMessage: (msg: string) => void;
    handleSetLocation: (location: string) => void;
}

const ScraperContext = createContext<ScraperContextType | undefined>(undefined);

const initialServiceState: ServiceState = {
    isScrapingCategories: false,
    categoryProgress: { current: 0, total: 0, categoryName: "", mainCategory: "" },
    categoryResults: [],
    completedMainCategories: [],
    totalMainCategories: 0,
    excelFilePath: null,
    excelFileName: null,
    categorySearchTerm: "",
    products: [],
    isLoading: false
};

export const ScraperProvider = ({ children }: { children: ReactNode }) => {
    const [activeService, setActiveService] = useState<Service>('zepto'); // Default
    const [locationStatus, setLocationStatus] = useState({ isSet: false, isLoading: false, location: "" });
    const [loadingMessage, setLoadingMessage] = useState("");

    const [servicesState, setServicesState] = useState<Record<Service, ServiceState>>({
        zepto: { ...initialServiceState },
        blinkit: { ...initialServiceState }
    });

    const updateServiceState = (service: Service, updates: Partial<ServiceState>) => {
        setServicesState(prev => ({
            ...prev,
            [service]: { ...prev[service], ...updates }
        }));
    };

    const handleWebSocketMessage = useCallback((data: WebSocketMessage) => {
        // Global message handling logic (migrated from App.tsx)
        if (data.action === "statusUpdate") {
            // Prevent background processes (like failing Instamart) from restoring "Setting location..." message
            if (locationStatus.isSet && data.message?.includes("Setting location")) {
                return;
            }
            if (data.message && data.step !== 'scrapeCategories') {
                setLoadingMessage(data.message);
            }

            if (data.step === "initialize" && data.status === "completed") {
                toast.success("Browsers initialized!");
            }

            if (data.step === "setLocation") {
                if (data.locationResults) {
                    const results = data.locationResults as LocationResult[];

                    // Relaxed check: Only Zepto and Blinkit are required
                    const zeptoResult = results.find(r => r.service === 'zepto');
                    const blinkitResult = results.find(r => r.service === 'blinkit');

                    const isZeptoSuccess = zeptoResult?.success ?? false;
                    const isBlinkitSuccess = blinkitResult?.success ?? false;

                    // Success if Zepto AND Blinkit worked
                    const isCriticalSuccess = isZeptoSuccess && isBlinkitSuccess;

                    setLocationStatus((prev: any) => ({ ...prev, isSet: isCriticalSuccess, isLoading: false }));

                    if (isCriticalSuccess) {
                        setLoadingMessage("");
                        toast.success("Location set for all services");
                    } else {
                        // Critical failure
                        const failures = [];
                        if (!isZeptoSuccess) failures.push('Zepto');
                        if (!isBlinkitSuccess) failures.push('Blinkit');
                        toast.error(`Failed to set location for: ${failures.join(', ')}`);
                    }
                }
            }

            // Handle category scraping updates
            if (data.step === "scrapeCategories") {
                const service = (data.service as Service) || activeService;

                if (data.status === "loading") {
                    updateServiceState(service, { isScrapingCategories: true });
                } else if (data.status === "progress") {
                    updateServiceState(service, {
                        isScrapingCategories: true,
                        categoryProgress: {
                            current: data.current || 0,
                            total: data.total || 0,
                            categoryName: data.categoryName || "",
                            mainCategory: data.mainCategory || ""
                        }
                    });
                } else if (data.status === "completed") {
                    let downloadUrl = null;
                    if (data.fileData) {
                        try {
                            // Convert Base64 to Blob
                            const byteCharacters = atob(data.fileData);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) {
                                byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

                            // Create Object URL
                            downloadUrl = URL.createObjectURL(blob);
                        } catch (e) {
                            console.error("Failed to process Excel file data", e);
                            toast.error("Failed to process download file");
                        }
                    }

                    updateServiceState(service, {
                        isScrapingCategories: false,
                        excelFilePath: downloadUrl, // Store the Blob URL
                        excelFileName: data.fileName || "scraped_data.xlsx" // Store filename
                    });
                    toast.success("Category scraping completed!");
                } else if (data.status === "error") {
                    updateServiceState(service, { isScrapingCategories: false });
                    toast.error(data.message || "Scraping failed");
                }
            }
        }

        // Handle search results
        if (data.action === "serviceSearchUpdate") {
            const service = data.service as Service;
            if (service) {
                updateServiceState(service, {
                    products: data.products || [],
                    isLoading: data.status === 'loading'
                });
            }
        }

        // Handle other events like 'categoryScraped', 'mainCategoryCompleted'
        if (data.action === "categoryScraped" && data.service) {
            // Handle incremental update
        }
    }, [activeService, locationStatus.isSet]);

    const { isConnected, sendMessage } = useWebSocket({
        onMessage: handleWebSocketMessage,
        onConnect: useCallback(() => toast.success("Connected to server"), []),
        onDisconnect: useCallback(() => toast.error("Disconnected from server"), [])
    });

    const handleSetLocation = (location: string) => {
        setLocationStatus({ location, isLoading: true, isSet: false });
        setLoadingMessage(`Setting location to ${location}...`);
        sendMessage({ action: "setLocation", location });
    };

    return (
        <ScraperContext.Provider value={{
            isConnected,
            activeService,
            setActiveService,
            locationStatus,
            setLocationStatus,
            servicesState,
            updateServiceState,
            sendMessage,
            loadingMessage,
            setLoadingMessage,
            handleSetLocation
        }}>
            {children}
        </ScraperContext.Provider>
    );
};

export const useScraper = () => {
    const context = useContext(ScraperContext);
    if (context === undefined) {
        throw new Error('useScraper must be used within a ScraperProvider');
    }
    return context;
};
