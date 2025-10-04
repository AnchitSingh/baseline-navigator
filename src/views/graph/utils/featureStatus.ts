import { FeatureStatus } from '../types';

export function getFeatureStatus(feature: any): FeatureStatus {
    const baseline = feature.status?.baseline || feature.status?.baseline_status;

    switch (baseline) {
        case 'widely':
        case 'high':
            return {
                key: 'widely',
                label: 'Widely Available',
                color: '#4CAF50',
                size: 25
            };
        case 'newly':
        case 'low':
            return {
                key: 'newly',
                label: 'Newly Available',
                color: '#FFC107',
                size: 20
            };
        case 'limited':
        case false:
            return {
                key: 'limited',
                label: 'Limited Support',
                color: '#F44336',
                size: 15
            };
        default:
            // FIX: Changed from gray (#9E9E9E) to red (#F44336)
            return {
                key: 'unknown',
                label: 'Unknown',
                color: '#F44336', // RED instead of gray
                size: 12
            };
    }
}