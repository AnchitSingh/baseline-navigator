import { GraphNode } from '../types';

export function layoutByCompatibility(nodes: GraphNode[]): void {
    const groups: Record<string, GraphNode[]> = {
        widely: [],
        newly: [],
        limited: [],
        unknown: []
    };

    nodes.forEach(node => {
        const group = groups[node.status] || groups.unknown;
        group.push(node);
    });

    let radius = 100;
    Object.entries(groups).forEach(([status, groupNodes], groupIndex) => {
        groupNodes.forEach((node, i) => {
            const angle = (i / groupNodes.length) * Math.PI * 2;
            node.x = Math.cos(angle) * radius * (groupIndex + 1);
            node.y = Math.sin(angle) * radius * (groupIndex + 1);
        });
    });
}

export function layoutByCategory(nodes: GraphNode[]): void {
    const categories: Record<string, GraphNode[]> = {};
    nodes.forEach(node => {
        const cat = node.category || 'other';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(node);
    });

    const cols = Math.ceil(Math.sqrt(Object.keys(categories).length));
    let catIndex = 0;

    Object.entries(categories).forEach(([cat, catNodes]) => {
        const col = catIndex % cols;
        const row = Math.floor(catIndex / cols);
        const baseX = (col - cols / 2) * 300;
        const baseY = (row - 2) * 300;

        catNodes.forEach((node, i) => {
            const angle = (i / catNodes.length) * Math.PI * 2;
            node.x = baseX + Math.cos(angle) * 80;
            node.y = baseY + Math.sin(angle) * 80;
        });
        catIndex++;
    });
}

export function layoutByTimeline(nodes: GraphNode[]): void {
    const sorted = [...nodes].sort((a, b) => {
        const dateA = new Date(a.baselineDate || '2000-01-01');
        const dateB = new Date(b.baselineDate || '2000-01-01');
        return dateA.getTime() - dateB.getTime();
    });

    sorted.forEach((node, i) => {
        node.x = (i - sorted.length / 2) * 50;
        node.y = Math.sin(i * 0.5) * 100;
    });
}