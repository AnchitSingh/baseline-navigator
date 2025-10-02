import { Feature, Recommendation, RecommendationContext } from '../types';
import { InvertedIndex } from './InvertedIndex';

export class RecommendationEngine {
    constructor(private index: InvertedIndex) {}

    public async getRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
        await this.index.waitForReady();
        const recommendations: Recommendation[] = [];
        
        const currentFeature = this.index.getFeature(context.currentFeature);
        if (!currentFeature) return [];

        // Get alternatives if current feature has limited support
        if (this.isLimitedSupport(currentFeature)) {
            const alternatives = await this.findAlternatives(currentFeature);
            if (alternatives.length > 0) {
                recommendations.push({
                    feature: alternatives[0],
                    reason: `Better browser support than ${currentFeature.name}`,
                    confidence: 0.9,
                    alternatives: alternatives.slice(1, 3)
                });
            }
        }

        // Get upgrade path if newer version exists
        const upgrade = await this.findUpgradePath(currentFeature);
        if (upgrade) {
            recommendations.push({
                feature: upgrade,
                reason: 'Newer version available with enhanced features',
                confidence: 0.85,
                upgrade
            });
        }

        // Get related features
        const similar = await this.index.getSimilarFeatures(context.currentFeature);
        similar.slice(0, 3).forEach(feature => {
            if (this.isWidelySupported(feature)) {
                recommendations.push({
                    feature,
                    reason: `Related to ${currentFeature.name}`,
                    confidence: 0.7
                });
            }
        });

        // Context-aware recommendations
        if (context.documentLanguage === 'css') {
            const cssRecommendations = await this.getCSSRecommendations(currentFeature);
            recommendations.push(...cssRecommendations);
        }

        return this.rankRecommendations(recommendations);
    }

    private async findAlternatives(feature: Feature): Promise<Feature[]> {
        const alternatives: Feature[] = [];
        
        // Predefined alternatives mapping
        const alternativeMap: Record<string, string[]> = {
            'subgrid': ['grid', 'flexbox'],
            'container-queries': ['media-queries', 'clamp'],
            'css-has': ['css-not', 'css-is'],
            'backdrop-filter': ['filter', 'opacity'],
            'gap': ['margin', 'padding'],
            'aspect-ratio': ['padding-hack', 'viewport-units'],
            'scroll-snap': ['scroll-behavior', 'smooth-scroll'],
        };

        const altIds = alternativeMap[feature.id] || [];
        for (const altId of altIds) {
            const altFeature = this.index.getFeature(altId);
            if (altFeature && this.isWidelySupported(altFeature)) {
                alternatives.push(altFeature);
            }
        }

        // Find features in same category with better support
        const category = feature.spec?.category || feature.group;
        if (category) {
            const categoryFeatures = await this.index.getByCategory(category);
            const betterSupported = categoryFeatures
                .filter(f => 
                    f.id !== feature.id && 
                    this.isWidelySupported(f) &&
                    this.calculateSimilarity(feature, f) > 0.5
                )
                .slice(0, 3);
            alternatives.push(...betterSupported);
        }

        return alternatives;
    }

    private async findUpgradePath(feature: Feature): Promise<Feature | null> {
        // Look for features with similar names but newer baseline dates
        const allFeatures = this.index.getAllFeatures();
        const baseName = feature.name?.toLowerCase().replace(/[0-9]+$/, '') || '';
        
        const upgrades = allFeatures.filter(f => {
            if (f.id === feature.id) return false;
            const fname = f.name?.toLowerCase() || '';
            return fname.includes(baseName) && 
                   this.isNewerThan(f, feature) &&
                   this.isWidelySupported(f);
        });

        return upgrades[0] || null;
    }

    private async getCSSRecommendations(feature: Feature): Promise<Recommendation[]> {
        const recommendations: Recommendation[] = [];
        
        // Modern CSS features that work well together
        const modernCSSPairs: Record<string, string[]> = {
            'grid': ['subgrid', 'gap', 'grid-template'],
            'flexbox': ['gap', 'flex-wrap', 'align-content'],
            'custom-properties': ['calc', 'clamp', 'min-max'],
            'transforms': ['transform-3d', 'perspective', 'backface-visibility'],
        };

        const relatedIds = modernCSSPairs[feature.id] || [];
        for (const relatedId of relatedIds) {
            const relatedFeature = this.index.getFeature(relatedId);
            if (relatedFeature && this.isWidelySupported(relatedFeature)) {
                recommendations.push({
                    feature: relatedFeature,
                    reason: `Works well with ${feature.name}`,
                    confidence: 0.75
                });
            }
        }

        return recommendations;
    }

    private calculateSimilarity(f1: Feature, f2: Feature): number {
        let score = 0;
        
        // Same category
        if (f1.spec?.category === f2.spec?.category) score += 0.3;
        if (f1.group === f2.group) score += 0.2;
        
        // Similar names
        const name1 = f1.name?.toLowerCase() || '';
        const name2 = f2.name?.toLowerCase() || '';
        const nameWords1 = new Set(name1.split(/\s+/));
        const nameWords2 = new Set(name2.split(/\s+/));
        const commonWords = Array.from(nameWords1).filter(w => nameWords2.has(w));
        score += (commonWords.length / Math.max(nameWords1.size, nameWords2.size)) * 0.5;
        
        return Math.min(score, 1);
    }

    private rankRecommendations(recommendations: Recommendation[]): Recommendation[] {
        return recommendations.sort((a, b) => {
            // Sort by confidence first
            if (b.confidence !== a.confidence) {
                return b.confidence - a.confidence;
            }
            
            // Then by baseline status
            const aScore = this.getBaselineScore(a.feature);
            const bScore = this.getBaselineScore(b.feature);
            return bScore - aScore;
        });
    }

    private getBaselineScore(feature: Feature): number {
        const baseline = feature.status?.baseline;
        if (baseline === 'widely') return 3;
        if (baseline === 'newly') return 2;
        if (baseline === 'limited') return 1;
        return 0;
    }

    private isWidelySupported(feature: Feature): boolean {
        return feature.status?.baseline === 'widely';
    }

    private isLimitedSupport(feature: Feature): boolean {
        const baseline = feature.status?.baseline;
        return baseline === 'limited' || baseline === false;
    }

    private isNewerThan(f1: Feature, f2: Feature): boolean {
        const date1 = f1.status?.baseline_low_date;
        const date2 = f2.status?.baseline_low_date;
        if (!date1 || !date2) return false;
        return new Date(date1) > new Date(date2);
    }
}