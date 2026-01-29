"use client"

import { Toaster } from "react-hot-toast"
import { Package2, AlertCircle } from "lucide-react"
import { ScraperProvider, useScraper } from "./context/ScraperContext"
import { LocationSetup } from "./components/LocationSetup"
import { ServiceTabs } from "./components/ServiceTabs"
import { CategoryScraper } from "./components/CategoryScraper"
import { LoadingIndicator } from "@/components/loading-indicator"

const ScraperContent = () => {
  const { locationStatus, loadingMessage, isConnected } = useScraper();

  // We access context error manually if needed, or rely on toast
  // Actually context doesn't expose error state directly in my implementation in step 345?
  // Let me check ScraperContext implementation.
  // I exposed `isConnected` but not `error` from `useWebSocket`.
  // Wait, I should expose `error` in ScraperContext.

  // Correction: I need to update ScraperContext to expose error if I want to show the alert.
  // Or I can ignore the alert since I use toasts.
  // The original App.tsx used both.

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
