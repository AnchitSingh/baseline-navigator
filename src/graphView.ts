import * as vscode from 'vscode';

export class GraphView {
    private panel: vscode.WebviewPanel | undefined;
    private featuresPromise: Promise<any>;
    
    constructor(private extensionUri: vscode.Uri) {
        this.featuresPromise = import('web-features');
    }
    
    public async show() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }
        
        this.panel = vscode.window.createWebviewPanel(
            'baselineGraph',
            'Baseline Feature Graph',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        
        this.panel.webview.html = await this.getHtmlContent();
        
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }
    
    private async getHtmlContent(): Promise<string> {
        const { features } = await this.featuresPromise;
        
        const nodes: any[] = [];
        const links: any[] = [];
        const featureArray = Object.entries(features);
        
        // Build nodes - use more features
        featureArray.slice(0, 100).forEach(([id, feature]: [string, any], idx) => {
            const status = feature.status?.baseline_status || feature.status?.baseline || 'unknown';
            
            // Better color coding
            let color = '#9E9E9E'; // Gray for unknown
            let statusLabel = 'Unknown';
            
            if (status === 'high' || status === 'widely') {
                color = '#4CAF50'; // Green
                statusLabel = 'Widely Available';
            } else if (status === 'low' || status === 'newly') {
                color = '#FFC107'; // Yellow/Orange
                statusLabel = 'Newly Available';
            } else if (status === 'limited' || status === false) {
                color = '#F44336'; // Red
                statusLabel = 'Limited';
            }
            
            nodes.push({
                id,
                name: feature.name || id,
                status: statusLabel,
                color,
                val: 15, // Node size
                group: feature.group || 'other'
            });
        });
        
        // Create smarter links based on groups and categories
        const groupMap = new Map<string, string[]>();
        nodes.forEach(node => {
            if (!groupMap.has(node.group)) {
                groupMap.set(node.group, []);
            }
            groupMap.get(node.group)!.push(node.id);
        });
        
        // Link nodes in the same group
        groupMap.forEach((nodeIds) => {
            for (let i = 0; i < nodeIds.length - 1; i++) {
                if (Math.random() > 0.5) { // Don't connect everything
                    links.push({
                        source: nodeIds[i],
                        target: nodeIds[i + 1],
                        value: 1
                    });
                }
            }
        });
        
        const graphData = JSON.stringify({ nodes, links });
        
        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body { 
                    margin: 0; 
                    overflow: hidden; 
                    background: #1e1e1e; 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }
                #graph { width: 100vw; height: 100vh; }
                #info {
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    background: rgba(30, 30, 30, 0.9);
                    padding: 15px;
                    border-radius: 8px;
                    color: white;
                    font-size: 12px;
                    max-width: 300px;
                    border: 1px solid #444;
                }
                .legend {
                    margin-top: 10px;
                    display: flex;
                    gap: 15px;
                    flex-wrap: wrap;
                }
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .legend-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                }
            </style>
        </head>
        <body>
            <div id="info">
                <div><strong>Baseline Feature Graph</strong></div>
                <div style="margin-top: 8px; font-size: 11px; opacity: 0.8;">
                    Click nodes to see details • Drag to explore
                </div>
                <div class="legend">
                    <div class="legend-item">
                        <div class="legend-dot" style="background: #4CAF50;"></div>
                        <span>Widely Available</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background: #FFC107;"></div>
                        <span>Newly Available</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background: #F44336;"></div>
                        <span>Limited</span>
                    </div>
                </div>
            </div>
            <div id="graph"></div>
            <script src="https://unpkg.com/force-graph"></script>
            <script>
                const data = ${graphData};
                
                const graph = ForceGraph()
                    (document.getElementById('graph'))
                    .graphData(data)
                    .nodeLabel(node => \`<div style="padding: 8px; background: #000; border-radius: 4px;">
                        <strong>\${node.name}</strong><br/>
                        Status: \${node.status}<br/>
                        ID: \${node.id}
                    </div>\`)
                    .nodeColor('color')
                    .nodeRelSize(8)
                    .linkColor(() => 'rgba(255,255,255,0.15)')
                    .linkWidth(1)
                    .d3AlphaDecay(0.02)
                    .d3VelocityDecay(0.3)
                    .onNodeClick(node => {
                        const info = document.getElementById('info');
                        info.innerHTML = \`
                            <div><strong>\${node.name}</strong></div>
                            <div style="margin-top: 8px;">
                                <strong>Status:</strong> \${node.status}<br/>
                                <strong>ID:</strong> \${node.id}<br/>
                                <strong>Group:</strong> \${node.group}
                            </div>
                            <div style="margin-top: 10px; font-size: 11px; opacity: 0.8;">
                                Click anywhere to reset
                            </div>
                        \`;
                    })
                    .onBackgroundClick(() => {
                        document.getElementById('info').innerHTML = \`
                            <div><strong>Baseline Feature Graph</strong></div>
                            <div style="margin-top: 8px; font-size: 11px; opacity: 0.8;">
                                Click nodes to see details • Drag to explore
                            </div>
                            <div class="legend">
                                <div class="legend-item">
                                    <div class="legend-dot" style="background: #4CAF50;"></div>
                                    <span>Widely Available</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-dot" style="background: #FFC107;"></div>
                                    <span>Newly Available</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-dot" style="background: #F44336;"></div>
                                    <span>Limited</span>
                                </div>
                            </div>
                        \`;
                    });
                
                // Better initial positioning
                graph.d3Force('charge').strength(-300);
                graph.d3Force('link').distance(50);
            </script>
        </body>
        </html>`;
    }
}
