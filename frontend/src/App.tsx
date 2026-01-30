"use client"

import { Toaster } from "react-hot-toast"
import { Package2, AlertCircle } from "lucide-react"
import { ScraperProvider, useScraper } from "./context/ScraperContext"
import { LocationSetup } from "./components/LocationSetup"
import { ServiceTabs } from "./components/ServiceTabs"
import { CategoryScraper } from "./components/CategoryScraper"
import { LoadingIndicator } from "@/components/loading-indicator"
import { SimpleSearchForm } from "@/components/SimpleSearchForm"
import * as XLSX from "xlsx"

const ScraperContent = () => {
  const { locationStatus, loadingMessage, isConnected, activeService, servicesState } = useScraper();
  const currentService = servicesState[activeService];

  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 flex-grow">
      {/* Connection Status Banner if needed */}
      {!isConnected && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-200 text-yellow-700 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 mr-2 text-yellow-500" />
          <span>Connecting to server...</span>
        </div>
      )}

      {loadingMessage && (
        <LoadingIndicator message={loadingMessage} />
      )}

      {!locationStatus.isSet ? (
        <LocationSetup />
      ) : (
        <>
          <ServiceTabs />

          {/* Product Search Section - Only for Blinkit and Instamart */}
          {activeService !== 'zepto' && (
            <>
              <SimpleSearchForm />

              {/* Search Results */}
              {currentService.products.length > 0 && (
                <div className="mb-6 p-4 bg-white rounded-lg shadow-md border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">
                      Search Results: {currentService.products.length} products found
                    </h3>
                    <button
                      onClick={() => {
                        // Create worksheet and workbook from current products
                        const worksheet = XLSX.utils.json_to_sheet(currentService.products);
                        const workbook = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

                        // Use XLSX.write to get a buffer and then create a Blob
                        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
                        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

                        // Explicitly trigger download using a temporary link
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', `${activeService}_products_${new Date().toISOString().slice(0, 10)}.xlsx`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                    >
                      📥 Save as Excel Spreadsheet
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentService.products.slice(0, 6).map((product: any, idx: number) => (
                      <div key={idx} className="p-3 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                        {product.imageUrl && (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-32 object-contain mb-2" />
                        )}
                        <h4 className="font-semibold text-sm text-gray-800 mb-1">{product.name}</h4>
                        <p className="text-gray-600 text-xs mb-1">{product.quantity}</p>
                        <p className="text-green-600 font-bold text-sm">{product.price}</p>
                        {product.originalPrice && (
                          <p className="text-gray-400 text-xs line-through">{product.originalPrice}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {currentService.products.length > 6 && (
                    <p className="text-center text-gray-500 text-sm mt-3">
                      ...and {currentService.products.length - 6} more products
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Category Scraping - Only for Zepto */}
          <CategoryScraper />
        </>
      )}
    </main>
  )
}

export default function Home() {
  return (
    <ScraperProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Toaster position="top-center" reverseOrder={false} />
        <header className="bg-orange-500 text-white shadow-md sticky top-0 z-50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            <div className="flex items-center">
              <Package2 className="h-8 w-8 mr-2 text-white" />
              <h1 className="text-xl sm:text-2xl font-bold">QuickCom Scraper</h1>
            </div>
          </div>
        </header>
        <ScraperContent />
      </div>
    </ScraperProvider>
  )
}
