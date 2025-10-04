export interface GraphNode {
    id: string;
    label: string;
    x: number;
    y: number;
    radius: number;
    color: string;
    status: string;
    category?: string; // ADD THIS
    browsers?: any;
    baselineDate?: string;
    dimmed: boolean;
    usageCount?: number;
    fileCount?: number;
    files?: string[];
    risk?: boolean;
}

export interface GraphEdge {
    from: GraphNode;
    to: GraphNode;
    type: 'alternative' | 'upgrade' | 'related' | 'colocated';
    strength: number;
    highlighted?: boolean;
}

export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface FeatureStatus {
    key: string;
    label: string;
    color: string;
    size: number;
}