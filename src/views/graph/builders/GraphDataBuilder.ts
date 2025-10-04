import { GraphData, GraphNode, GraphEdge } from '../types';
import { getFeatureStatus } from '../utils/featureStatus';
import { ALTERNATIVES_MAPPING, UPGRADES_MAPPING } from '../../../core/FeatureMappings';

export class GraphDataBuilder {
    async buildMeaningfulGraph(features: any[]): Promise<GraphData> {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const nodeMap = new Map<string, GraphNode>();

        // Create nodes
        features.slice(0, 100).forEach(feature => {
            const status = getFeatureStatus(feature);
            const node: GraphNode = {
                id: feature.id,
                label: feature.name || feature.id,
                x: (Math.random() - 0.5) * 800,
                y: (Math.random() - 0.5) * 600,
                radius: status.size,
                color: status.color,
                status: status.key,
                category: feature.spec?.category || feature.group || 'general',
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
        const categoryGroups = new Map<string, GraphNode[]>();
        nodes.forEach(node => {
            if (!categoryGroups.has(node.category!)) {
                categoryGroups.set(node.category!, []);
            }
            categoryGroups.get(node.category!)!.push(node);
        });

        categoryGroups.forEach(group => {
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