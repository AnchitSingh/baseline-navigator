import { Feature, Recommendation, RecommendationContext } from '../types';
import { InvertedIndex } from './InvertedIndex';
import { FeaturePatternRegistry } from './FeaturePatternRegistry';
import { SimilarityEngine, SimilarityScore } from './SimilarityEngine';

export class RecommendationEngine {
    private patternRegistry: FeaturePatternRegistry;
    private similarityEngine: SimilarityEngine;
    private recommendationCache: Map<string, Recommendation[]> = new Map();
    private cacheTimeout = 5 * 60 * 1000; // 5 minutes

    constructor(private index: InvertedIndex) {
        this.patternRegistry = new FeaturePatternRegistry();
        this.similarityEngine = new SimilarityEngine();
    }

    public async getRecommendations(context: RecommendationContext): Promise<Recommendation[]> {

        try {
            await this.index.waitForReady();

        } catch (error) {
            return [];
        }

        // Check cache
        const cacheKey = this.getCacheKey(context);
        if (this.recommendationCache.has(cacheKey)) {
            const cached = this.recommendationCache.get(cacheKey)!;
            return cached;
        }

        const recommendations: Recommendation[] = [];
        const currentFeature = this.index.getFeature(context.currentFeature);

        if (!currentFeature) {
            return [];
        }


        const allFeatures = this.index.getAllFeatures();

        // 1. HARDCODED ALTERNATIVES
        const hardcodedAlternatives = await this.getHardcodedAlternatives(currentFeature);
        recommendations.push(...hardcodedAlternatives);

        // 2. ALGORITHMIC ALTERNATIVES
        if (this.isLimitedSupport(currentFeature)) {
            const algorithmicAlternatives = await this.getAlgorithmicAlternatives(currentFeature, allFeatures);
            recommendations.push(...algorithmicAlternatives);
        }

        // 3. UPGRADE PATHS
        const upgrades = await this.getUpgradePaths(currentFeature, allFeatures);
        recommendations.push(...upgrades);

        // 4. COMPLEMENTARY FEATURES
        const complementary = await this.getComplementaryFeatures(currentFeature, allFeatures);
        recommendations.push(...complementary);

        // 5. CONTEXT-SPECIFIC
        const contextual = await this.getContextualRecommendations(currentFeature, context, allFeatures);
        recommendations.push(...contextual);


        // Rank and deduplicate
        const rankedRecommendations = this.rankRecommendations(recommendations);



        // Cache results
        this.recommendationCache.set(cacheKey, rankedRecommendations);
        setTimeout(() => this.recommendationCache.delete(cacheKey), this.cacheTimeout);

        return rankedRecommendations;
    }

    /**
     * Get hardcoded alternatives from pattern registry
     */
    private async getHardcodedAlternatives(feature: Feature): Promise<Recommendation[]> {
        const pattern = this.patternRegistry.getPattern(feature.id);
        if (!pattern?.alternatives) return [];

        const recommendations: Recommendation[] = [];

        for (const altId of pattern.alternatives) {
            const altFeature = this.index.getFeature(altId);
            if (altFeature && this.isWidelySupported(altFeature)) {
                recommendations.push({
                    feature: altFeature,
                    reason: `Better browser support than ${feature.name || feature.id}`,
                    confidence: 0.95, // High confidence for curated alternatives
                    type: 'alternative'
                });
            }
        }

        return recommendations;
    }

    /**
     * Get algorithmic alternatives using similarity engine
     */
    private async getAlgorithmicAlternatives(feature: Feature, allFeatures: Feature[]): Promise<Recommendation[]> {
        const alternatives = this.similarityEngine.findBetterAlternatives(feature, allFeatures, 3);

        return alternatives.map(alt => {
            const altFeature = this.index.getFeature(alt.featureId)!;
            return {
                feature: altFeature,
                reason: `Similar functionality with better support${alt.reasons.length > 0 ? ': ' + alt.reasons.join(', ') : ''}`,
                confidence: Math.min(0.85, alt.score), // Cap algorithmic confidence at 0.85
                type: 'alternative'
            };
        });
    }

    /**
     * Get upgrade paths (hardcoded + algorithmic)
     */
    private async getUpgradePaths(feature: Feature, allFeatures: Feature[]): Promise<Recommendation[]> {
        const recommendations: Recommendation[] = [];

        // 1. Hardcoded upgrades from pattern registry
        const pattern = this.patternRegistry.getPattern(feature.id);
        if (pattern?.upgradeTo) {
            const upgradeFeature = this.index.getFeature(pattern.upgradeTo);
            if (upgradeFeature && this.isWidelySupported(upgradeFeature)) {
                recommendations.push({
                    feature: upgradeFeature,
                    reason: `Modern replacement for ${feature.name || feature.id}`,
                    confidence: 0.9,
                    upgrade: upgradeFeature,
                    type: 'upgrade'
                });
            }
        }

        // 2. Algorithmic upgrades
        const algorithmicUpgrades = this.similarityEngine.findUpgradePaths(feature, allFeatures, 2);

        algorithmicUpgrades.forEach(upgrade => {
            const upgradeFeature = this.index.getFeature(upgrade.featureId)!;

            // Don't duplicate hardcoded upgrades
            if (!recommendations.find(r => r.feature.id === upgradeFeature.id)) {
                recommendations.push({
                    feature: upgradeFeature,
                    reason: `Newer version with enhanced features${upgrade.reasons.length > 0 ? ': ' + upgrade.reasons.join(', ') : ''}`,
                    confidence: Math.min(0.8, upgrade.score),
                    upgrade: upgradeFeature,
                    type: 'upgrade'
                });
            }
        });

        return recommendations;
    }

    /**
  * Get complementary features (hardcoded + algorithmic)
  */
    private async getComplementaryFeatures(feature: Feature, allFeatures: Feature[]): Promise<Recommendation[]> {
        const recommendations: Recommendation[] = [];

        // 1. Hardcoded complementary from pattern registry
        const pattern = this.patternRegistry.getPattern(feature.id);
        if (pattern?.complementary) {
            for (const compId of pattern.complementary.slice(0, 3)) {
                const compFeature = this.index.getFeature(compId);
                if (compFeature && this.isWidelySupported(compFeature)) {
                    recommendations.push({
                        feature: compFeature,
                        reason: `Works well with ${feature.name || feature.id}`,
                        confidence: 0.85,
                        type: 'complementary'
                    });
                }
            }
        }

        // 2. Algorithmic complementary - FIX: Handle group as array
        const category = feature.spec?.category || feature.group;

        if (category) {
            const categoryArray = Array.isArray(category) ? category : [category];

            const categoryFeatures = allFeatures.filter(f => {
                const fCategory = f.spec?.category || f.group;
                const fCategoryArray = Array.isArray(fCategory) ? fCategory : [fCategory];

                // Check if arrays have any overlap
                const hasOverlap = categoryArray.some(cat => fCategoryArray.includes(cat));

                return hasOverlap &&
                    f.id !== feature.id &&
                    this.isWidelySupported(f);
            });


            const algorithmicComp = this.similarityEngine.findComplementary(feature, categoryFeatures, 5);


            algorithmicComp.forEach(comp => {
                const compFeature = this.index.getFeature(comp.featureId)!;

                // Don't duplicate hardcoded complementary
                if (!recommendations.find(r => r.feature.id === compFeature.id)) {
                    recommendations.push({
                        feature: compFeature,
                        reason: `Related feature${comp.reasons.length > 0 ? ': ' + comp.reasons.join(', ') : ''}`,
                        confidence: Math.min(0.75, comp.score),
                        type: 'complementary'
                    });
                }
            });
        }

        return recommendations;
    }

    /**
 * Get context-specific recommendations
 */
    private async getContextualRecommendations(
        feature: Feature,
        context: RecommendationContext,
        allFeatures: Feature[]
    ): Promise<Recommendation[]> {
        const recommendations: Recommendation[] = [];

        // Determine if this is a CSS or JS feature
        const category = feature.spec?.category || feature.group;
        const categoryArray = Array.isArray(category) ? category : (category ? [category] : []);
        const categoryString = categoryArray.join(',');

        // Check if it's a JS feature
        const isJSFeature = categoryString.includes('javascript') ||
            categoryString.includes('api') ||
            categoryString.includes('array') ||
            categoryString.includes('promise') ||
            feature.id.includes('array-') ||
            feature.id.includes('promise') ||
            feature.id.includes('async');


        // Language-specific recommendations
        if (!isJSFeature && (context.documentLanguage === 'css' || context.documentLanguage === 'scss')) {
            // CSS-specific recommendations
            const modernCSSFeatures = ['grid', 'flexbox', 'custom-properties', 'clamp'];

            modernCSSFeatures.forEach(featureId => {
                if (featureId !== feature.id) {
                    const modernFeature = this.index.getFeature(featureId);
                    if (modernFeature && this.isWidelySupported(modernFeature)) {
                        recommendations.push({
                            feature: modernFeature,
                            reason: 'Modern CSS feature for better layouts',
                            confidence: 0.6,
                            type: 'contextual'
                        });
                    }
                }
            });
        } else if (isJSFeature) {
            // JS-specific recommendations
            const modernJSFeatures = ['promises', 'async-await', 'es6-modules', 'fetch'];

            modernJSFeatures.forEach(featureId => {
                if (featureId !== feature.id) {
                    const modernFeature = this.index.getFeature(featureId);
                    if (modernFeature && this.isWidelySupported(modernFeature)) {
                        recommendations.push({
                            feature: modernFeature,
                            reason: 'Modern JavaScript feature',
                            confidence: 0.6,
                            type: 'contextual'
                        });
                    }
                }
            });
        }

        // Only return top 2 contextual recommendations
        return recommendations.slice(0, 2);
    }

    /**
     * Rank recommendations by type and confidence
     */
    private rankRecommendations(recommendations: Recommendation[]): Recommendation[] {
        // Remove duplicates
        const unique = new Map<string, Recommendation>();
        recommendations.forEach(rec => {
            const existing = unique.get(rec.feature.id);
            if (!existing || rec.confidence > existing.confidence) {
                unique.set(rec.feature.id, rec);
            }
        });

        // Sort by priority: alternatives > upgrades > complementary > contextual
        const typePriority: Record<string, number> = {
            'alternative': 4,
            'upgrade': 3,
            'complementary': 2,
            'contextual': 1
        };

        return Array.from(unique.values())
            .sort((a, b) => {
                // First by type priority
                const aPriority = typePriority[a.type || 'contextual'] || 0;
                const bPriority = typePriority[b.type || 'contextual'] || 0;

                if (aPriority !== bPriority) {
                    return bPriority - aPriority;
                }

                // Then by confidence
                return b.confidence - a.confidence;
            })
            .slice(0, 10); // Max 10 recommendations
    }

    private isWidelySupported(feature: Feature): boolean {
        const baseline = feature.status?.baseline;
        // FIX: Handle both 'widely' and 'high'
        return baseline === 'widely' || baseline === 'high';
    }

    private isLimitedSupport(feature: Feature): boolean {
        const baseline = feature.status?.baseline;
        // FIX: Handle both naming conventions
        return baseline === 'limited' ||
            baseline === 'low' ||
            baseline === false ||
            baseline === undefined;
    }

    private getCacheKey(context: RecommendationContext): string {
        return `${context.currentFeature}_${context.documentLanguage}_${context.projectType || 'default'}`;
    }
}