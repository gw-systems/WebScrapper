import React from 'react';
import { useScraper } from '../../context/ScraperContext';
import { SERVICE_INFO } from '../../constants';
import { downloadCategoryExcel } from '../../utils/excelExport';
import { getServiceStyles } from '../../utils/styles';

export const ResultsPreview: React.FC = () => {
    const { activeService, servicesState } = useScraper();
    const serviceInfo = SERVICE_INFO[activeService];
    const state = servicesState[activeService];
    const styles = getServiceStyles(serviceInfo.color);

    if (state.categoryResults.length === 0) return null;

    const totalProducts = state.categoryResults.reduce((sum, cat) => sum + cat.productCount, 0);

    return (
        <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
                <h4 className={`text-md font-semibold ${styles.text}`}>
                    Preview ({totalProducts} products)
                </h4>
                <button
                    onClick={() => downloadCategoryExcel(activeService, state.categoryResults, state.categorySearchTerm)}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                >
                    📥 Download Excel
                </button>
            </div>
            <div className={`bg-white rounded-lg p-4 max-h-96 overflow-y-auto border ${styles.border}`}>
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            <th className="p-2 text-left">Category</th>
                            <th className="p-2 text-right">Product Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        {state.categoryResults.map((result, idx) => (
                            <tr key={idx} className="border-t hover:bg-gray-50">
                                <td className="p-2">{result.category}</td>
                                <td className="p-2 text-right font-medium">{result.productCount}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
