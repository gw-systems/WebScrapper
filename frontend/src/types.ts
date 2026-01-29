export type Service = 'zepto' | 'blinkit' | 'instamart';

export interface WebSocketMessage {
    action: string;
    service?: Service;
    status?: 'loading' | 'completed' | 'error' | 'success' | 'info' | 'skipped';
    message?: string;
    step?: string;
    data?: any;
    [key: string]: any;
}

export interface LocationResult {
    service: Service;
    success: boolean;
    location?: string;
    error?: string;
}

export interface Product {
    category?: string;
    mainCategory?: string;
    subCategory?: string;
    brand?: string;
    name?: string;
    productName?: string;
    price?: string;
    quantity?: string;
    rating?: string;
    imageUrl?: string;
    image?: string;
    available?: boolean;
}

export interface CategoryScrapeResult {
    category: string;
    products: Product[];
    totalProducts: number;
}
