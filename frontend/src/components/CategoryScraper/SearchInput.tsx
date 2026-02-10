import React from 'react';
import { useScraper } from '../../context/ScraperContext';
import { Input } from '../ui/input';
import { SERVICE_INFO } from '../../constants';
import { getServiceStyles } from '../../utils/styles';
import { Button } from '../ui/button';

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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateServiceState(activeService, { categorySearchTerm: e.target.value })}
                    className={`flex-1 ${styles.input}`}
                    disabled={state.isScrapingCategories}
                />
                <Button
                    onClick={() => {
                        if (state.categorySearchTerm.trim()) {
                            handleScrapeCategories(0, state.categorySearchTerm)
                        }
                    }}
                    disabled={state.isScrapingCategories || !isConnected || !state.categorySearchTerm.trim()}
                    className={`text-white transition-colors whitespace-nowrap ${styles.button}`}
                >
                    {state.isScrapingCategories ? "Scraping..." : "🔍 Search & Scrape"}
                </Button>
            </div>

            <div className="flex items-center gap-3">
                <div className={`flex-1 border-t ${styles.wrapper}`}></div>
                <span className={`text-sm font-medium ${styles.textLight}`}>OR</span>
                <div className={`flex-1 border-t ${styles.wrapper}`}></div>
            </div>

            <Button
                onClick={() => handleScrapeCategories(0, "")}
                disabled={state.isScrapingCategories || !isConnected}
                className={`w-full text-white transition-colors font-semibold ${styles.button}`}
            >
                {state.isScrapingCategories ? "Scraping..." : "📦 Scrape ALL Categories"}
            </Button>
        </div>
    );
};
