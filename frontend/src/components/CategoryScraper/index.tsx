import React from 'react';
import { useScraper } from '../../context/ScraperContext';
import { SERVICE_INFO } from '../../constants';
import { SearchInput } from './SearchInput';
import { ProgressTracker } from './ProgressTracker';
import { ResultsPreview } from './ResultsPreview';
import { getServiceStyles } from '../../utils/styles';

export const CategoryScraper: React.FC = () => {
    const { activeService, servicesState } = useScraper();
    const serviceInfo = SERVICE_INFO[activeService];
    const state = servicesState[activeService];
    const styles = getServiceStyles(serviceInfo.color);

    if (activeService !== 'zepto') {
        return (
            <div className={`mb-6 p-4 rounded-lg bg-gray-50 border border-gray-200 text-center text-gray-500`}>
                <h3 className="text-lg font-semibold mb-2">🛒 Category Scraping</h3>
                <p>Category scraping is currently available only for <strong>Zepto</strong>.</p>
                <p className="text-sm mt-1">Please switch to the Zepto tab to use this feature.</p>
            </div>
        );
    }

    return (
        <div className={`mb-6 p-4 rounded-lg ${styles.container}`}>
            <h3 className={`text-lg font-semibold mb-3 ${styles.text}`}>
                🛒 {serviceInfo.name} Category Scraping
            </h3>

            {/* Main Category Progress (Previous Runs) */}
            {state.totalMainCategories > 0 && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-green-800">
                            📊 Main Categories Progress: {state.completedMainCategories.length} / {state.totalMainCategories}
                        </p>
                        {state.excelFilePath && (
                            <a
                                href={state.excelFilePath}
                                download={state.excelFileName || "data.xlsx"}
                                className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            >
                                📥 Download Excel
                            </a>
                        )}
                    </div>
                    <div className="w-full bg-green-200 rounded-full h-2.5">
                        <div
                            className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${(state.completedMainCategories.length / state.totalMainCategories) * 100}%` }}
                        ></div>
                    </div>
                    {state.completedMainCategories.length > 0 && (
                        <div className="mt-2">
                            <p className="text-xs text-green-700 font-medium">Completed:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {state.completedMainCategories.map((cat, idx) => (
                                    <span key={idx} className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded">
                                        ✓ {cat}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <SearchInput />
            <ProgressTracker />
            <ResultsPreview />
        </div>
    );
};
