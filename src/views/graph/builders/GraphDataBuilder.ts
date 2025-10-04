import { GraphData, GraphNode, GraphEdge } from '../types';
import { getFeatureStatus } from '../utils/featureStatus';
import { ALTERNATIVES_MAPPING, UPGRADES_MAPPING } from '../../../core/FeatureMappings';
import { FeaturePatternRegistry } from '../../../core/FeaturePatternRegistry';

export class GraphDataBuilder {
    private patternRegistry: FeaturePatternRegistry;

    constructor() {
        this.patternRegistry = new FeaturePatternRegistry();
    }

    async buildMeaningfulGraph(features: any[]): Promise<GraphData> {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const nodeMap = new Map<string, GraphNode>();

        // Create nodes with proper categorization
        features.slice(0, 100).forEach(feature => {
            const status = getFeatureStatus(feature);
            
            // Get actual category from web-features
            const actualCategory = feature.spec?.category || feature.group || 'other';
            
            // Get pattern definition for subcategory and language type
            const pattern = this.patternRegistry.getPattern(feature.id);
            
            // Determine language type
            let languageType: 'css' | 'js' | 'html' | 'api' = 'css';
            if (pattern) {
                languageType = pattern.category;
            } else {
                // Fallback detection if not in pattern registry
                if (feature.id.includes('api') || 
                    feature.id.includes('observer') || 
                    feature.id.includes('promise') ||
                    feature.id.includes('async') ||
                    feature.id.includes('fetch') ||
                    feature.id.includes('custom-elements') ||
                    feature.id.includes('shadow')) {
                    languageType = 'js';
                }
            }
            
            const node: GraphNode = {
                id: feature.id,
                label: feature.name || feature.id,
                x: (Math.random() - 0.5) * 800,
                y: (Math.random() - 0.5) * 600,
                radius: status.size,
                color: status.color,
                status: status.key,
                category: actualCategory,           // ACTUAL category (e.g., "layout", "selectors")
                subcategory: pattern?.subcategory,  // Subcategory from registry
                languageType: languageType,         // Language type for filtering
                browsers: feature.status?.support,
                baselineDate: feature.status?.baseline_low_date,
                dimmed: false
            };

            nodes.push(node);
            nodeMap.set(feature.id, node);
        });

        // Create edges
        this.createAlternativeEdges(edges, nodeMap);
        this.createUpgradeEdges(edges, nodeMap);
        this.createCategoryEdges(edges, nodes);

        return { nodes, edges };
    }

    private createAlternativeEdges(edges: GraphEdge[], nodeMap: Map<string, GraphNode>): void {
        Object.entries(ALTERNATIVES_MAPPING).forEach(([limited, betterOptions]) => {
            const fromNode = nodeMap.get(limited);
            if (fromNode) {
                betterOptions.forEach(better => {
                    const toNode = nodeMap.get(better);
                    if (toNode) {
                        edges.push({
                            from: fromNode,
                            to: toNode,
                            type: 'alternative',
                            strength: 0.8
                        });
                    }
                });
            }
        });
    }

    private createUpgradeEdges(edges: GraphEdge[], nodeMap: Map<string, GraphNode>): void {
        Object.entries(UPGRADES_MAPPING).forEach(([old, newer]) => {
            const fromNode = nodeMap.get(old);
            const toNode = nodeMap.get(newer);
            if (fromNode && toNode) {
                edges.push({
                    from: fromNode,
                    to: toNode,
                    type: 'upgrade',
                    strength: 1
                });
            }
        });
    }

    private createCategoryEdges(edges: GraphEdge[], nodes: GraphNode[]): void {
        // Group by ACTUAL category (not language type)
        const categoryGroups = new Map<string, GraphNode[]>();
        nodes.forEach(node => {
            const cat = node.category || 'other';
            if (!categoryGroups.has(cat)) {
                categoryGroups.set(cat, []);
            }
            categoryGroups.get(cat)!.push(node);
        });

        categoryGroups.forEach(group => {
            // Connect features within same category
            for (let i = 0; i < Math.min(group.length - 1, 3); i++) {
                edges.push({
                    from: group[i],
                    to: group[i + 1],
                    type: 'related',
                    strength: 0.3
                });
            }
        });
    }
}