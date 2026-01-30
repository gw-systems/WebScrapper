import React from 'react';
import { useScraper } from '../../context/ScraperContext';
import { Input } from '../ui/input';
import { SERVICE_INFO } from '../../constants';
import { getServiceStyles } from '../../utils/styles';

export const SearchInput: React.FC = () => {
    const { activeService, servicesState, updateServiceState, sendMessage, isConnected } = useScraper();
    const serviceInfo = SERVICE_INFO[activeService];
    const state = servicesState[activeService];
    const styles = getServiceStyles(serviceInfo.color);

    const handleScrapeCategories = (maxCategories: number = 334, categoryFilter: string = "") => {
        if (!isConnected) return;

        updateServiceState(activeService, {
            isScrapingCategories: true,
            categoryProgress: { current: 0, total: 0, categoryName: "", mainCategory: "" },
            categoryResults: [],
            completedMainCategories: [],
            totalMainCategories: 0,
            excelFilePath: null
        });

        sendMessage({
            action: "scrapeCategories",
            service: activeService, // Fix: Pass the active service
            maxCategories,
            categoryFilter: categoryFilter.trim()
        });
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
                <Input
                    placeholder="Search category (e.g., beverages, snacks, dairy...)"
                    value={state.categorySearchTerm}
                    onChange={(e) => updateServiceState(activeService, { categorySearchTerm: e.target.value })}
                    className={`flex-1 ${styles.input}`}
                    disabled={state.isScrapingCategories}
                />
                <button
                    onClick={() => {
                        if (state.categorySearchTerm.trim()) {
                            handleScrapeCategories(0, state.categorySearchTerm)
                        }
                    }}
                    disabled={state.isScrapingCategories || !isConnected || !state.categorySearchTerm.trim()}
                    className={`px-4 py-2 text-white rounded-md transition-colors whitespace-nowrap disabled:bg-gray-400 disabled:cursor-not-allowed ${styles.button}`}
                >
                    {state.isScrapingCategories ? "Scraping..." : "🔍 Search & Scrape"}
                </button>
            </div>

            <div className="flex items-center gap-3">
                <div className={`flex-1 border-t ${styles.wrapper}`}></div>
                <span className={`text-sm font-medium ${styles.textLight}`}>OR</span>
                <div className={`flex-1 border-t ${styles.wrapper}`}></div>
            </div>

            <button
                onClick={() => handleScrapeCategories(0, "")}
                disabled={state.isScrapingCategories || !isConnected}
                className={`w-full px-4 py-2 text-white rounded-md transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed ${styles.button}`}
            >
                {state.isScrapingCategories ? "Scraping..." : "📦 Scrape ALL Categories"}
            </button>
        </div>
    );
};
