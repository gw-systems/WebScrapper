import React from 'react';
import { useScraper } from '../context/ScraperContext';
import type { Service } from '../types';
import { SERVICE_INFO } from '../constants';
import { getServiceStyles } from '../utils/styles';

export const ServiceTabs: React.FC = () => {
    const { activeService, setActiveService } = useScraper();
    const services: Service[] = ["zepto", "blinkit"];

    return (
        <div className="mb-6 border-b border-gray-200">
            <ul className="flex flex-wrap -mb-px text-sm font-medium text-center">
                {services.map((service) => {
                    const styles = getServiceStyles(SERVICE_INFO[service].color);
                    const isActive = activeService === service;

                    return (
                        <li className="mr-2" key={service}>
                            <button
                                className={`inline-block p-4 rounded-t-lg ${isActive
                                    ? styles.activeTab + ' font-semibold'
                                    : 'hover:text-gray-600 hover:border-gray-300'
                                    }`}
                                onClick={() => setActiveService(service)}
                            >
                                <div className="flex items-center gap-2">
                                    <img src={SERVICE_INFO[service].logo} alt={`${service} logo`} className="h-5 w-auto" />
                                    {SERVICE_INFO[service].name}
                                </div>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};
