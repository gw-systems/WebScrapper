import type { Service } from '../types';

export const getServiceStyles = (color: string) => {
    // We use color name to map to specific classes
    // This ensures Tailwind JIT picks them up if we hardcode them here,
    // OR we rely on the fact that we return full strings.

    // Actually, simplest way for JIT is to return the full class set based on service/color.

    switch (color) {
        case 'purple': // Zepto
            return {
                container: 'bg-purple-50 border border-purple-200',
                wrapper: 'border-purple-300',
                text: 'text-purple-900',
                textLight: 'text-purple-600',
                textMedium: 'text-purple-700',
                button: 'bg-purple-600 hover:bg-purple-700',
                buttonOutline: 'border-purple-500 text-purple-600 focus:ring-purple-500',
                progressBar: 'bg-purple-600',
                progressBg: 'bg-purple-200',
                border: 'border-purple-200',
                activeTab: 'border-b-2 border-purple-500 text-purple-600',
                input: 'border-purple-300 focus:border-purple-500 focus:ring-purple-500'
            };
        case 'green': // Blinkit
            return {
                container: 'bg-green-50 border border-green-200',
                wrapper: 'border-green-300',
                text: 'text-green-900',
                textLight: 'text-green-600',
                textMedium: 'text-green-700',
                button: 'bg-green-600 hover:bg-green-700',
                buttonOutline: 'border-green-500 text-green-600 focus:ring-green-500',
                progressBar: 'bg-green-600',
                progressBg: 'bg-green-200',
                border: 'border-green-200',
                activeTab: 'border-b-2 border-green-500 text-green-600',
                input: 'border-green-300 focus:border-green-500 focus:ring-green-500'
            };
        case 'orange': // Instamart
            return {
                container: 'bg-orange-50 border border-orange-200',
                wrapper: 'border-orange-300',
                text: 'text-orange-900',
                textLight: 'text-orange-600',
                textMedium: 'text-orange-700',
                button: 'bg-orange-600 hover:bg-orange-700',
                buttonOutline: 'border-orange-500 text-orange-600 focus:ring-orange-500',
                progressBar: 'bg-orange-600',
                progressBg: 'bg-orange-200',
                border: 'border-orange-200',
                activeTab: 'border-b-2 border-orange-500 text-orange-600',
                input: 'border-orange-300 focus:border-orange-500 focus:ring-orange-500'
            };
        default:
            return {
                container: 'bg-gray-50 border border-gray-200',
                wrapper: 'border-gray-300',
                text: 'text-gray-900',
                textLight: 'text-gray-600',
                textMedium: 'text-gray-700',
                button: 'bg-gray-600 hover:bg-gray-700',
                buttonOutline: 'border-gray-500 text-gray-600 focus:ring-gray-500',
                progressBar: 'bg-gray-600',
                progressBg: 'bg-gray-200',
                border: 'border-gray-200',
                activeTab: 'border-b-2 border-gray-500 text-gray-600',
                input: 'border-gray-300 focus:border-gray-500 focus:ring-gray-500'
            };
    }
};
