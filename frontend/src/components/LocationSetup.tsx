import React from 'react';
import { useScraper } from '../context/ScraperContext';
import { Input } from './ui/input';
import { Button } from './ui/button';

export const LocationSetup: React.FC = () => {
    const { isConnected, locationStatus, setLocationStatus, handleSetLocation } = useScraper();

    return (
        <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
                Set Location
            </h2>
            <p className="text-sm text-gray-600 mb-4">
                This location will be used for all services (Zepto, Blinkit)
            </p>
            <div className="flex gap-2">
                <Input
                    placeholder="Enter location (e.g., Mumbai, Delhi...)"
                    value={locationStatus.location}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocationStatus({ ...locationStatus, location: e.target.value })}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter' && locationStatus.location.trim()) {
                            handleSetLocation(locationStatus.location)
                        }
                    }}
                    disabled={!isConnected || locationStatus.isLoading}
                    className="flex-1"
                />
                <Button
                    onClick={() => handleSetLocation(locationStatus.location)}
                    disabled={!isConnected || locationStatus.isLoading || !locationStatus.location.trim()}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                    {locationStatus.isLoading ? "Setting..." : "Set Location"}
                </Button>
            </div>
        </div>
    );
};
