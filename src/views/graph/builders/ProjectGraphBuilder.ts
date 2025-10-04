import { GraphData, GraphNode } from '../types';
import { ProjectAnalysis } from '../../../core/ProjectAnalyzer';
import { getFeatureStatus } from '../utils/featureStatus';

export class ProjectGraphBuilder {
    buildProjectGraph(analysis: ProjectAnalysis): GraphData {
        const nodes: GraphNode[] = [];
        const edges: any[] = [];

        // Create nodes from project features
        analysis.features.forEach((projectFeature, featureId) => {
            const status = getFeatureStatus(projectFeature.feature);
            nodes.push({
                id: featureId,
                label: projectFeature.feature.name || featureId,
                x: (Math.random() - 0.5) * 600,
                y: (Math.random() - 0.5) * 400,
                radius: Math.min(10 + projectFeature.usageCount * 2, 40),
                color: status.color,
                status: status.key,
                usageCount: projectFeature.usageCount,
                fileCount: projectFeature.files.length,
                files: projectFeature.files,
                risk: status.key === 'limited' || status.key === 'newly' || status.key === 'unknown',
                dimmed: false
            });
        });

        // Create edges between features in same files
        const fileFeatureMap = new Map<string, string[]>();
        analysis.features.forEach((pf, featureId) => {
            pf.files.forEach(file => {
                if (!fileFeatureMap.has(file)) {
                    fileFeatureMap.set(file, []);
                }
                fileFeatureMap.get(file)!.push(featureId);
            });
        });

        fileFeatureMap.forEach(features => {
            for (let i = 0; i < features.length - 1; i++) {
                for (let j = i + 1; j < features.length; j++) {
                    const fromNode = nodes.find(n => n.id === features[i]);
                    const toNode = nodes.find(n => n.id === features[j]);
                    if (fromNode && toNode) {
                        edges.push({
                            from: fromNode,
                            to: toNode,
                            type: 'colocated',
                            strength: 0.3
                        });
                    }
                }
            }
        });

        return { nodes, edges };
    }
}