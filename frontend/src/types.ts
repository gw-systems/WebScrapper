export type Service = 'zepto' | 'blinkit';

export interface WebSocketMessage {
    action: string;
    step?: string;
    status?: 'loading' | 'progress' | 'completed' | 'error' | 'info';
    message?: string;
    service?: string;
    data?: any;
    current?: number;
    total?: number;
    categoryName?: string;
    mainCategory?: string;
    fileUrl?: string;
    fileData?: string;
    fileName?: string;
    products?: Product[];
    locationResults?: LocationResult[];
}

export interface LocationResult {
    service: Service;
    success: boolean;
    error?: string;
}

export interface CategoryScrapeResult {
    id: string;
    name: string;
    status: 'pending' | 'scraped' | 'failed';
}

export interface Product {
    id: string;
    name: string;
    brand?: string;
    price: string;
    originalPrice?: string; // offer_price or mrp logic might vary
    quantity: string;
    imageUrl?: string;
    rating?: string;
    inStock?: boolean;
    category?: string;
    source: 'zepto' | 'blinkit' | 'instamart';
}

export interface ScraperState {
    locationStatus: {
        isSet: boolean;
        location: string;
        isLoading: boolean;
    };
    loadingMessage: string | null;
    isConnected: boolean;
    activeService: Service;
    servicesState: {
        [key: string]: {
            products: Product[];
            categories: any[];
            isScrapingCategories: boolean;
            categoryProgress: { current: number; total: number; categoryName: string; mainCategory: string };
            categoryResults: CategoryScrapeResult[];
            completedMainCategories: string[];
            totalMainCategories: number;
            excelFilePath: string | null;
            excelFileName: string | null;
            categorySearchTerm: string;
            isLoading: boolean;
        };
    };
}
