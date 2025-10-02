export class InvertedIndex {
    private browserIndex: Map<string, Set<string>> = new Map();
    private featuresPromise: Promise<any>;
    
    constructor() {
        this.featuresPromise = import('web-features').then(mod => {
            this.buildIndex(mod.features);
            return mod.features;
        });
    }
    
    private buildIndex(features: any) {
        Object.entries(features).forEach(([id, feature]: [string, any]) => {
            const support = feature.status?.support;
            if (!support) return;
            
            Object.entries(support).forEach(([browser, version]) => {
                const key = `${browser}_${version}`;
                if (!this.browserIndex.has(key)) {
                    this.browserIndex.set(key, new Set());
                }
                this.browserIndex.get(key)!.add(id);
            });
        });
    }
    
    public async getAvailableFeatures(targetBrowsers: string[]): Promise<string[]> {
        await this.featuresPromise;
        
        const available: Set<string>[] = [];
        
        targetBrowsers.forEach(target => {
            const [browser, version] = this.parseTarget(target);
            const key = `${browser}_${version}`;
            const feats = this.browserIndex.get(key);
            if (feats) available.push(feats);
        });
        
        if (available.length === 0) return [];
        
        const result = Array.from(available[0]).filter(id =>
            available.every(set => set.has(id))
        );
        
        return result;
    }
    
    private parseTarget(target: string): [string, string] {
        const match = target.match(/(\w+)\s*>=?\s*(\d+)/);
        return match ? [match[1], match[2]] : ['', ''];
    }
}
