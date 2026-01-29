import React from 'react';
import { useScraper } from '../../context/ScraperContext';
import { SERVICE_INFO } from '../../constants';
import { getServiceStyles } from '../../utils/styles';

export const ProgressTracker: React.FC = () => {
    const { activeService, servicesState } = useScraper();
    const serviceInfo = SERVICE_INFO[activeService];
    const state = servicesState[activeService];
    const styles = getServiceStyles(serviceInfo.color);

    if (!state.isScrapingCategories && state.categoryProgress.total === 0 && !state.excelFilePath) return null;

    return (
        <div className="mt-4">
            {/* Download Button Section */}
            {!state.isScrapingCategories && state.excelFilePath && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md flex items-center justify-between">
                    <div>
                        <h4 className="font-semibold text-green-800">Scraping Completed!</h4>
                        <p className="text-sm text-green-700">Excel file is ready for download.</p>
                    </div>
                    <a
                        href={state.excelFilePath}
                        download={state.excelFileName || "data.xlsx"}
                        className={`px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2`}
                    >
                        📥 Download Excel
                    </a>
                </div>
            )}

            {/* Progress Bar (Show while scraping or if we have progress state) */}
            {(state.isScrapingCategories || state.categoryProgress.total > 0) && (
                <>
                    <div className={`flex justify-between text-sm mb-1 ${styles.textMedium}`}>
                        <span>Progress: {state.categoryProgress.current} / {state.categoryProgress.total}</span>
                        <span>{Math.round((state.categoryProgress.current / state.categoryProgress.total) * 100)}%</span>
                    </div>
                    <div className={`w-full rounded-full h-2.5 ${styles.progressBg}`}>
                        <div
                            className={`h-2.5 rounded-full transition-all duration-300 ${styles.progressBar}`}
                            style={{ width: `${(state.categoryProgress.current / state.categoryProgress.total) * 100}%` }}
                        ></div>
                    </div>
                    {state.isScrapingCategories && (
                        <div className="mt-2">
                            <p className={`text-sm font-medium ${styles.textMedium}`}>
                                Currently scraping: <span className={styles.text}>{state.categoryProgress.categoryName}</span>
                            </p>
                            {state.categoryProgress.mainCategory && (
                                <p className={`text-xs ${styles.textLight}`}>
                                    Main category: <span className="font-semibold">{state.categoryProgress.mainCategory}</span>
                                </p>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
