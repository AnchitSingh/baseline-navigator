export interface Feature {
    id: string;
    name?: string;
    description?: string;
    description_html?: string;
    status?: {
        baseline?: 'widely' | 'newly' | 'limited' | false;
        baseline_status?: string;
        baseline_low_date?: string;
        baseline_high_date?: string;
        support?: Record<string, string>;
    };
    spec?: {
        category?: string;
        links?: string[];
    };
    group?: string;
    caniuse?: string;
    mdn_url?: string;
    tags?: string[];
}

export interface FeatureNode {
    id: string;
    name: string;
    status: string;
    color: string;
    val: number;
    group: string;
    description?: string;
    support?: Record<string, string>;
    relatedFeatures?: string[];
}

export interface RecommendationContext {
    currentFeature: string;
    documentLanguage: string;
    projectType?: string;
    targetBrowsers?: string[];
}

export interface Recommendation {
    feature: Feature;
    reason: string;
    confidence: number;
    alternatives?: Feature[];
    upgrade?: Feature;
    type?: 'alternative' | 'upgrade' | 'complementary' | 'contextual'; // ADD THIS
}

export interface CompatibilityReport {
    feature: Feature;
    compatibility: 'full' | 'partial' | 'none';
    missingBrowsers: string[];
    suggestion?: string;
}