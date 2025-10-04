/**
 * Algorithmic similarity detection for features
 * Provides multiple similarity metrics to find related features
 */

import { Feature } from '../types';

export interface SimilarityScore {
    featureId: string;
    score: number;
    reasons: string[];
}

export class SimilarityEngine {
    /**
     * Calculate text similarity between two strings using Jaccard similarity
     */
    private jaccardSimilarity(str1: string, str2: string): number {
        const words1 = new Set(str1.toLowerCase().split(/\s+/));
        const words2 = new Set(str2.toLowerCase().split(/\s+/));

        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size;
    }

    /**
     * Calculate Levenshtein distance (edit distance)
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const m = str1.length;
        const n = str2.length;
        const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = Math.min(
                        dp[i - 1][j - 1] + 1, // substitution
                        dp[i - 1][j] + 1,     // deletion
                        dp[i][j - 1] + 1      // insertion
                    );
                }
            }
        }

        return dp[m][n];
    }

    /**
     * Normalize Levenshtein distance to 0-1 similarity score
     */
    private levenshteinSimilarity(str1: string, str2: string): number {
        const distance = this.levenshteinDistance(str1, str2);
        const maxLen = Math.max(str1.length, str2.length);
        return maxLen === 0 ? 1 : 1 - (distance / maxLen);
    }

    /**
     * Calculate name similarity between two features
     */
    public nameSimilarity(feature1: Feature, feature2: Feature): number {
        const name1 = (feature1.name || feature1.id).toLowerCase();
        const name2 = (feature2.name || feature2.id).toLowerCase();

        // Exact match
        if (name1 === name2) return 1.0;

        // ID match
        if (feature1.id === feature2.id) return 1.0;

        // Substring match
        if (name1.includes(name2) || name2.includes(name1)) {
            return 0.8;
        }

        // Combine Jaccard and Levenshtein
        const jaccardScore = this.jaccardSimilarity(name1, name2);
        const levenScore = this.levenshteinSimilarity(name1, name2);

        return (jaccardScore * 0.6 + levenScore * 0.4);
    }

    /**
     * Calculate description similarity
     */
    public descriptionSimilarity(feature1: Feature, feature2: Feature): number {
        const desc1 = feature1.description || feature1.description_html || '';
        const desc2 = feature2.description || feature2.description_html || '';

        if (!desc1 || !desc2) return 0;

        // Remove HTML tags
        const cleanDesc1 = desc1.replace(/<[^>]*>/g, ' ').toLowerCase();
        const cleanDesc2 = desc2.replace(/<[^>]*>/g, ' ').toLowerCase();

        return this.jaccardSimilarity(cleanDesc1, cleanDesc2);
    }

    /**
     * Calculate category similarity
     */
    public categorySimilarity(feature1: Feature, feature2: Feature): number {
        // Same spec category
        if (feature1.spec?.category && feature2.spec?.category) {
            if (feature1.spec.category === feature2.spec.category) {
                return 1.0;
            }
        }

        // Same group
        if (feature1.group && feature2.group) {
            if (feature1.group === feature2.group) {
                return 0.8;
            }
        }

        // Tag overlap
        if (feature1.tags && feature2.tags) {
            const tags1 = new Set(feature1.tags);
            const tags2 = new Set(feature2.tags);
            const intersection = new Set([...tags1].filter(x => tags2.has(x)));

            if (intersection.size > 0) {
                return intersection.size / Math.max(tags1.size, tags2.size) * 0.6;
            }
        }

        return 0;
    }

    /**
     * Calculate browser support overlap
     */
    public browserSupportSimilarity(feature1: Feature, feature2: Feature): number {
        const support1 = feature1.status?.support;
        const support2 = feature2.status?.support;

        if (!support1 || !support2) return 0;

        const browsers1 = Object.keys(support1);
        const browsers2 = Object.keys(support2);

        if (browsers1.length === 0 || browsers2.length === 0) return 0;

        let totalSimilarity = 0;
        let commonBrowsers = 0;

        browsers1.forEach(browser => {
            if (support2[browser]) {
                commonBrowsers++;
                const version1 = parseFloat(support1[browser]);
                const version2 = parseFloat(support2[browser]);

                if (isNaN(version1) || isNaN(version2)) return;

                // Closer version numbers = higher similarity
                const versionDiff = Math.abs(version1 - version2);
                const versionSimilarity = Math.max(0, 1 - (versionDiff / 50)); // 50 version difference = 0 similarity

                totalSimilarity += versionSimilarity;
            }
        });

        if (commonBrowsers === 0) return 0;

        // Average similarity across common browsers
        const avgSimilarity = totalSimilarity / commonBrowsers;

        // Penalize if they don't support same browsers
        const browserOverlap = commonBrowsers / Math.max(browsers1.length, browsers2.length);

        return avgSimilarity * browserOverlap;
    }

    /**
     * Calculate baseline status similarity
     */
    public baselineSimilarity(feature1: Feature, feature2: Feature): number {
        const baseline1 = feature1.status?.baseline;
        const baseline2 = feature2.status?.baseline;

        // Exact match
        if (baseline1 === baseline2) return 1.0;

        // Both widely supported
        if (baseline1 === 'widely' && baseline2 === 'widely') {
            return 1.0;
        }

        // Both newly available
        if (baseline1 === 'newly' && baseline2 === 'newly') {
            return 0.8;
        }

        // Both have limited/no support
        if ((baseline1 === 'limited' || baseline1 === false) &&
            (baseline2 === 'limited' || baseline2 === false)) {
            return 0.8;
        }

        return 0;
    }

    /**
     * Calculate temporal similarity (features from similar time periods)
     */
    public temporalSimilarity(feature1: Feature, feature2: Feature): number {
        const date1 = feature1.status?.baseline_low_date;
        const date2 = feature2.status?.baseline_low_date;

        if (!date1 || !date2) return 0;

        const time1 = new Date(date1).getTime();
        const time2 = new Date(date2).getTime();

        const daysDiff = Math.abs(time1 - time2) / (1000 * 60 * 60 * 24);

        // Features within 1 year = high similarity
        // Features > 3 years apart = low similarity
        if (daysDiff < 365) return 1.0;
        if (daysDiff < 730) return 0.7;
        if (daysDiff < 1095) return 0.4;

        return 0;
    }

    /**
     * Calculate composite similarity score
     */
    public calculateSimilarity(feature1: Feature, feature2: Feature, weights?: {
        name?: number;
        description?: number;
        category?: number;
        browserSupport?: number;
        baseline?: number;
        temporal?: number;
    }): SimilarityScore {
        // Default weights
        const w = {
            name: weights?.name ?? 0.25,
            description: weights?.description ?? 0.15,
            category: weights?.category ?? 0.25,
            browserSupport: weights?.browserSupport ?? 0.15,
            baseline: weights?.baseline ?? 0.1,
            temporal: weights?.temporal ?? 0.1
        };

        const scores = {
            name: this.nameSimilarity(feature1, feature2),
            description: this.descriptionSimilarity(feature1, feature2),
            category: this.categorySimilarity(feature1, feature2),
            browserSupport: this.browserSupportSimilarity(feature1, feature2),
            baseline: this.baselineSimilarity(feature1, feature2),
            temporal: this.temporalSimilarity(feature1, feature2)
        };

        const totalScore =
            scores.name * w.name +
            scores.description * w.description +
            scores.category * w.category +
            scores.browserSupport * w.browserSupport +
            scores.baseline * w.baseline +
            scores.temporal * w.temporal;

        // Build reasons array
        const reasons: string[] = [];
        if (scores.name > 0.7) reasons.push('Similar name');
        if (scores.category > 0.7) reasons.push('Same category');
        if (scores.browserSupport > 0.7) reasons.push('Similar browser support');
        if (scores.baseline === 1.0) reasons.push('Same baseline status');
        if (scores.description > 0.5) reasons.push('Related functionality');
        if (scores.temporal > 0.7) reasons.push('Similar release timeframe');

        return {
            featureId: feature2.id,
            score: totalScore,
            reasons
        };
    }

    /**
     * Find most similar features from a list
     */
    public findSimilar(
        targetFeature: Feature,
        candidates: Feature[],
        options?: {
            minScore?: number;
            maxResults?: number;
            weights?: any;
        }
    ): SimilarityScore[] {
        const minScore = options?.minScore ?? 0.3;
        const maxResults = options?.maxResults ?? 10;

        const similarities = candidates
            .filter(f => f.id !== targetFeature.id)
            .map(f => this.calculateSimilarity(targetFeature, f, options?.weights))
            .filter(s => s.score >= minScore)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);

        return similarities;
    }

    /**
 * Find better alternatives (higher baseline status, similar functionality)
 */
    public findBetterAlternatives(
        targetFeature: Feature,
        candidates: Feature[],
        maxResults: number = 5
    ): SimilarityScore[] {
        const targetBaseline = targetFeature.status?.baseline;

        // Only look for alternatives if current feature has limited support
        if (targetBaseline === 'widely') {
            return []; // Already widely supported, no need for alternatives
        }

        // Find features with better support but similar functionality
        const alternatives = candidates
            .filter(f => {
                const baseline = f.status?.baseline;
                // Feature must be widely supported
                return baseline === 'widely' && f.id !== targetFeature.id;
            })
            .map(f => this.calculateSimilarity(targetFeature, f, {
                name: 0.3,
                description: 0.2,
                category: 0.4, // Higher weight on category for alternatives
                browserSupport: 0.05,
                baseline: 0.05,
                temporal: 0
            }))
            .filter(s => s.score >= 0.4) // Higher threshold for alternatives
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);

        return alternatives;
    }

    /**
     * Find upgrade paths (newer versions of same feature)
     */
    public findUpgradePaths(
        targetFeature: Feature,
        candidates: Feature[],
        maxResults: number = 3
    ): SimilarityScore[] {
        const targetDate = targetFeature.status?.baseline_low_date;
        if (!targetDate) return [];

        const targetTime = new Date(targetDate).getTime();

        // Find features with very similar names but newer dates
        const upgrades = candidates
            .filter(f => {
                const fDate = f.status?.baseline_low_date;
                if (!fDate) return false;

                const fTime = new Date(fDate).getTime();
                return fTime > targetTime && f.id !== targetFeature.id;
            })
            .map(f => this.calculateSimilarity(targetFeature, f, {
                name: 0.5,      // Very high weight on name
                description: 0.2,
                category: 0.3,
                browserSupport: 0,
                baseline: 0,
                temporal: 0
            }))
            .filter(s => s.score >= 0.6) // Must be quite similar
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);

        return upgrades;
    }

    /**
     * Find complementary features (often used together)
     */
    public findComplementary(
        targetFeature: Feature,
        candidates: Feature[],
        maxResults: number = 5
    ): SimilarityScore[] {
        // Features in same category with good support
        const complementary = candidates
            .filter(f => {
                const baseline = f.status?.baseline || f.status?.baseline_status;
                return (baseline === 'widely' || baseline === 'high') && f.id !== targetFeature.id;
            })
            .map(f => this.calculateSimilarity(targetFeature, f, {
                name: 0.1,
                description: 0.15,
                category: 0.5,  // Very high weight on category
                browserSupport: 0.15,
                baseline: 0.05,
                temporal: 0.05
            }))
            .filter(s => s.score >= 0.4)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);

        return complementary;
    }
}