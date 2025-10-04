import { Feature } from '../types';

export class InvertedIndex {
    private baselineIndex: Map<string, Set<string>> = new Map();
    private browserIndex: Map<string, Map<number, Set<string>>> = new Map();
    private categoryIndex: Map<string, Set<string>> = new Map();
    private tagIndex: Map<string, Set<string>> = new Map();
    private nameIndex: Map<string, string> = new Map();
    private features: Map<string, Feature> = new Map();
    private isReady: boolean = false;

    constructor() {
        this.initialize();
    }

    private async initialize() {
        try {
            const webFeatures = await import('web-features');
            this.buildIndices(webFeatures.features);
            this.isReady = true;
        } catch (error) {
            console.error('Failed to initialize InvertedIndex. The web-features package may not be installed or accessible:', error);
            // Provide a fallback empty index to avoid complete failure
            this.isReady = true; // Consider as ready but with no features
        }
    }

    private buildIndices(features: Record<string, any>) {
        Object.entries(features).forEach(([id, feature]) => {
            const enhancedFeature: Feature = { id, ...feature };
            this.features.set(id, enhancedFeature);

            // Index by baseline status
            const baseline = feature.status?.baseline || 'unknown';
            if (!this.baselineIndex.has(baseline)) {
                this.baselineIndex.set(baseline, new Set());
            }
            this.baselineIndex.get(baseline)!.add(id);

            // Index by browser support
            if (feature.status?.support) {
                Object.entries(feature.status.support).forEach(([browser, version]) => {
                    if (!this.browserIndex.has(browser)) {
                        this.browserIndex.set(browser, new Map());
                    }
                    const browserMap = this.browserIndex.get(browser)!;
                    const versionNum = parseInt(version as string, 10);
                    
                    if (!browserMap.has(versionNum)) {
                        browserMap.set(versionNum, new Set());
                    }
                    browserMap.get(versionNum)!.add(id);
                });
            }

            // Index by category
            const category = feature.spec?.category || feature.group || 'general';
            if (!this.categoryIndex.has(category)) {
                this.categoryIndex.set(category, new Set());
            }
            this.categoryIndex.get(category)!.add(id);

            // Index by tags (extract from description and name)
            const tags = this.extractTags(feature);
            tags.forEach(tag => {
                if (!this.tagIndex.has(tag)) {
                    this.tagIndex.set(tag, new Set());
                }
                this.tagIndex.get(tag)!.add(id);
            });

            // Index by name for fast lookups
            if (feature.name) {
                this.nameIndex.set(feature.name.toLowerCase(), id);
            }
        });
    }

    private extractTags(feature: any): string[] {
        const tags: string[] = [];
        const text = `${feature.name || ''} ${feature.description || ''}`.toLowerCase();
        
        // Extract common web technology keywords
        const keywords = ['css', 'grid', 'flex', 'animation', 'transform', 'shadow', 
                         'gradient', 'variable', 'custom', 'container', 'query', 
                         'selector', 'pseudo', 'media', 'viewport', 'responsive'];
        
        keywords.forEach(keyword => {
            if (text.includes(keyword)) {
                tags.push(keyword);
            }
        });

        return tags;
    }

    public async waitForReady(timeoutMs: number = 10000): Promise<void> {
        const startTime = Date.now();
        while (!this.isReady) {
            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`InvertedIndex failed to initialize within ${timeoutMs}ms`);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    public async search(query: string): Promise<Feature[]> {
        await this.waitForReady();
        const lowerQuery = query.toLowerCase();
        const results = new Set<string>();

        // Direct ID match
        if (this.features.has(lowerQuery)) {
            results.add(lowerQuery);
        }

        // Name match
        if (this.nameIndex.has(lowerQuery)) {
            results.add(this.nameIndex.get(lowerQuery)!);
        }

        // Partial matches in IDs and names
        this.features.forEach((feature, id) => {
            if (id.includes(lowerQuery) || 
                feature.name?.toLowerCase().includes(lowerQuery)) {
                results.add(id);
            }
        });

        // Tag matches
        if (this.tagIndex.has(lowerQuery)) {
            this.tagIndex.get(lowerQuery)!.forEach(id => results.add(id));
        }

        return Array.from(results).map(id => this.features.get(id)!);
    }

    public async getByBaseline(baseline: string): Promise<Feature[]> {
        await this.waitForReady();
        const ids = this.baselineIndex.get(baseline) || new Set();
        return Array.from(ids).map(id => this.features.get(id)!);
    }

    public async getByCategory(category: string): Promise<Feature[]> {
        await this.waitForReady();
        const ids = this.categoryIndex.get(category) || new Set();
        return Array.from(ids).map(id => this.features.get(id)!);
    }

    public async getSimilarFeatures(featureId: string): Promise<Feature[]> {
        await this.waitForReady();
        const feature = this.features.get(featureId);
        if (!feature) return [];

        const similar = new Map<string, number>();
        
        // Same category features
        const category = feature.spec?.category || feature.group;
        if (category) {
            const categoryFeatures = await this.getByCategory(category);
            categoryFeatures.forEach(f => {
                if (f.id !== featureId) {
                    similar.set(f.id, (similar.get(f.id) || 0) + 3);
                }
            });
        }

        // Same baseline status
        const baseline = feature.status?.baseline || 'unknown';
        const baselineFeatures = await this.getByBaseline(baseline);
        baselineFeatures.forEach(f => {
            if (f.id !== featureId) {
                similar.set(f.id, (similar.get(f.id) || 0) + 1);
            }
        });

        // Sort by similarity score
        const sorted = Array.from(similar.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        return sorted.map(([id]) => this.features.get(id)!);
    }

    public getFeature(id: string): Feature | undefined {
        return this.features.get(id);
    }

    public getAllFeatures(): Feature[] {
        return Array.from(this.features.values());
    }
}