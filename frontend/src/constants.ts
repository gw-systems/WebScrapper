import type { Service } from './types';

export interface ServiceData {
    logo: string;
    color: string;
    name: string;
}

export const SERVICE_INFO: Record<Service, ServiceData> = {
    zepto: { logo: "/src/assets/zepto.png", color: "purple", name: "Zepto" },
    blinkit: { logo: "/src/assets/blinkit.png", color: "green", name: "Blinkit" }
};
