"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Search, Loader2 } from "lucide-react"
import { useScraper } from "../context/ScraperContext"

export function SimpleSearchForm() {
    const [searchInput, setSearchInput] = useState("")
    const { sendMessage, isConnected, locationStatus, activeService } = useScraper()
    const [isSearching, setIsSearching] = useState(false)

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (searchInput && isConnected && locationStatus.isSet) {
            setIsSearching(true)
            // Send the active service so it only searches that service
            sendMessage({ action: "search", searchTerm: searchInput, service: activeService })

            // Reset searching state after a delay
            setTimeout(() => setIsSearching(false), 3000)
        }
    }

    if (activeService === 'blinkit') return null;

    return (
        <Card className="mb-6 shadow-md">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl text-slate-700">
                    <Search className="h-5 w-5 text-orange-500" />
                    Search Products
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSearchSubmit} className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                        <div className="flex-1">
                            <Label htmlFor="searchTerm" className="mb-1.5 block text-sm font-medium text-slate-600">
                                What are you looking for?
                            </Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    id="searchTerm"
                                    placeholder="e.g., milk, bread, vegetables"
                                    className="pl-10 h-10 text-sm sm:text-base border-slate-300 focus:border-orange-500 focus:ring-orange-500"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    disabled={!isConnected || isSearching || !locationStatus.isSet}
                                />
                            </div>
                            {!locationStatus.isSet && (
                                <p className="mt-1.5 text-xs text-red-600">Please set location first in the Location Setup tab.</p>
                            )}
                            {locationStatus.isSet && locationStatus.location && (
                                <p className="mt-1.5 text-xs text-slate-500">Searching in: <strong>{locationStatus.location}</strong></p>
                            )}
                        </div>
                        <Button
                            type="submit"
                            className="w-full sm:w-auto h-10 text-sm sm:text-base bg-orange-500 hover:bg-orange-600 text-white disabled:bg-slate-300"
                            disabled={!isConnected || isSearching || !searchInput || !locationStatus.isSet}
                        >
                            {isSearching ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Searching...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-1">
                                    <Search className="h-4 w-4" /> Search Products
                                </span>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
