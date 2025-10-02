import * as vscode from 'vscode';
import { InvertedIndex } from '../core/InvertedIndex';
import { FeatureNode } from '../types';
import { ProjectAnalyzer } from '../core/ProjectAnalyzer';
import { ProjectAnalysis } from '../core/ProjectAnalyzer';

export class GraphView {
    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private extensionUri: vscode.Uri,
        private index: InvertedIndex
    ) { }

    public async show() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'baselineGraph',
            'Baseline Feature Explorer - Compatibility Map',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.extensionUri]
            }
        );

        this.panel.webview.html = await this.getHtmlContent();

        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'getFeatureDetails':
                        const feature = this.index.getFeature(message.featureId);
                        const similar = await this.index.getSimilarFeatures(message.featureId);
                        this.panel?.webview.postMessage({
                            command: 'showDetails',
                            feature,
                            similar
                        });
                        break;
                    case 'findPath':
                        // Find upgrade path between features
                        const path = await this.findUpgradePath(message.from, message.to);
                        this.panel?.webview.postMessage({
                            command: 'showPath',
                            path
                        });
                        break;
                }
            }
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private async findUpgradePath(fromId: string, toId: string): Promise<any[]> {
        // Find the best path from limited feature to widely supported alternative
        const from = this.index.getFeature(fromId);
        const to = this.index.getFeature(toId);

        if (!from || !to) return [];

        // Simple path for now - can be enhanced with actual graph traversal
        return [from, to];
    }

    private async getHtmlContent(): Promise<string> {
        await this.index.waitForReady();
        const features = this.index.getAllFeatures();

        // Build MEANINGFUL graph data
        const graphData = await this.buildMeaningfulGraph(features);

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Baseline Compatibility Map</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: #0d1117;
                    color: #c9d1d9;
                    overflow: hidden;
                    user-select: none;
                }
                
                #container {
                    width: 100vw;
                    height: 100vh;
                    position: relative;
                }
                
                #canvas {
                    width: 100%;
                    height: 100%;
                }
                
                /* Control Panel */
                #controls {
                    position: absolute;
                    top: 20px;
                    left: 20px;
                    background: linear-gradient(135deg, #1a1f2e 0%, #221f3a 100%);
                    backdrop-filter: blur(10px);
                    padding: 24px;
                    border-radius: 16px;
                    width: 380px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .control-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 20px;
                }
                
                .control-title {
                    font-size: 20px;
                    font-weight: 600;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                
                /* View Modes */
                .view-modes {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    margin-bottom: 20px;
                }
                
                .view-mode {
                    padding: 10px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.3s;
                    font-size: 13px;
                }
                
                .view-mode:hover {
                    background: rgba(255, 255, 255, 0.1);
                    transform: translateY(-2px);
                }
                
                .view-mode.active {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-color: transparent;
                    color: white;
                }
                
                /* Search */
                #search-container {
                    position: relative;
                    margin-bottom: 20px;
                }
                
                #search {
                    width: 100%;
                    padding: 12px 40px 12px 16px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    color: white;
                    font-size: 14px;
                    outline: none;
                    transition: all 0.3s;
                }
                
                #search:focus {
                    background: rgba(255, 255, 255, 0.08);
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }
                
                .search-icon {
                    position: absolute;
                    right: 16px;
                    top: 50%;
                    transform: translateY(-50%);
                    opacity: 0.5;
                }
                
                /* Feature Cards */
                #selected-feature {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                
                .feature-name {
                    font-size: 18px;
                    font-weight: 600;
                    margin-bottom: 8px;
                }
                
                .feature-status {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    margin-bottom: 12px;
                }
                
                .status-widely {
                    background: rgba(76, 175, 80, 0.2);
                    color: #4CAF50;
                    border: 1px solid #4CAF50;
                }
                
                .status-newly {
                    background: rgba(255, 193, 7, 0.2);
                    color: #FFC107;
                    border: 1px solid #FFC107;
                }
                
                .status-limited {
                    background: rgba(244, 67, 54, 0.2);
                    color: #F44336;
                    border: 1px solid #F44336;
                }
                
                .browser-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    margin-top: 12px;
                }
                
                .browser-chip {
                    background: rgba(255, 255, 255, 0.05);
                    padding: 6px 10px;
                    border-radius: 6px;
                    font-size: 12px;
                    text-align: center;
                }
                
                /* Recommendations */
                .recommendations {
                    margin-top: 20px;
                }
                
                .recommendation-card {
                    background: rgba(102, 126, 234, 0.1);
                    border: 1px solid rgba(102, 126, 234, 0.3);
                    border-radius: 10px;
                    padding: 12px;
                    margin-bottom: 10px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .recommendation-card:hover {
                    background: rgba(102, 126, 234, 0.2);
                    transform: translateX(4px);
                }
                
                /* Legend Toggle Button */
                .legend-toggle {
                    position: absolute;
                    bottom: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 100;
                    font-size: 18px;
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                    transition: all 0.3s ease;
                }
                
                .legend-toggle:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.6);
                }
                
                /* Legend */
                .legend {
                    position: absolute;
                    bottom: 20px;
                    right: 20px;
                    background: rgba(26, 31, 46, 0.95);
                    backdrop-filter: blur(10px);
                    padding: 16px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    z-index: 99;
                    max-width: 300px;
                    transition: all 0.3s ease;
                    transform: translateY(20px);
                    opacity: 0;
                    visibility: hidden;
                }
                
                .legend.show {
                    transform: translateY(0);
                    opacity: 1;
                    visibility: visible;
                }
                
                .legend-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }
                
                .legend-close {
                    cursor: pointer;
                    font-size: 24px;
                    line-height: 1;
                    padding: 0 4px;
                    border-radius: 50%;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background-color 0.2s;
                }
                
                .legend-close:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                
                .legend-title {
                    font-size: 12px;
                    font-weight: 600;
                    margin-bottom: 12px;
                    opacity: 0.7;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                
                .legend-items {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 13px;
                }
                
                .legend-color {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    position: relative;
                }
                
                .legend-color.pulse {
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 currentColor; }
                    70% { box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
                }
                
                /* Info Cards */
                .info-popup {
                    position: absolute;
                    background: linear-gradient(135deg, #1a1f2e 0%, #221f3a 100%);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 12px;
                    padding: 16px;
                    min-width: 250px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                    display: none;
                    z-index: 1000;
                }
                
                .info-popup.show {
                    display: block;
                }
                
                /* Graph Stats */
                .graph-stats {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    background: rgba(26, 31, 46, 0.95);
                    padding: 16px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    font-size: 13px;
                }
                
                .stat-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }
                
                .stat-label {
                    opacity: 0.7;
                }
                
                .stat-value {
                    font-weight: 600;
                    color: #667eea;
                }
                
                /* Action Buttons */
                .action-buttons {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    margin-top: 20px;
                }
                
                .action-btn {
                    padding: 10px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .action-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                }
                
                /* Loading */
                .loading {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                }
                
                .loading-spinner {
                    width: 50px;
                    height: 50px;
                    border: 3px solid rgba(255, 255, 255, 0.1);
                    border-top-color: #667eea;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div id="container">
                <canvas id="canvas"></canvas>
                
                <!-- Control Panel -->
                <div id="controls">
                    <div class="control-header">
                        <span style="font-size: 28px;">🗺️</span>
                        <div class="control-title">Feature Compatibility Map</div>
                    </div>
                    
                    <!-- View Modes -->
                    <div class="view-modes">
                        <div class="view-mode active" data-mode="compatibility">
                            🎯 Compatibility
                        </div>
                        <div class="view-mode" data-mode="categories">
                            📦 Categories
                        </div>
                        <div class="view-mode" data-mode="timeline">
                            📅 Timeline
                        </div>
                    </div>
                    
                    <!-- Search -->
                    <div id="search-container">
                        <input type="text" id="search" placeholder="Search features (e.g., grid, flexbox, container)..." />
                        <span class="search-icon">🔍</span>
                    </div>
                    
                    <!-- Selected Feature -->
                    <div id="selected-feature" style="display: none;">
                        <div class="feature-name">Select a feature</div>
                        <div class="feature-status status-widely">Status</div>
                        <div class="browser-grid"></div>
                    </div>
                    
                    <!-- Recommendations -->
                    <div class="recommendations" id="recommendations" style="display: none;">
                        <div style="font-weight: 600; margin-bottom: 10px;">💡 Recommendations</div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="action-buttons">
                        <button class="action-btn" onclick="resetView()">
                            🔄 Reset View
                        </button>

                    </div>
                </div>
                
                <!-- Legend Toggle Button -->
                <div class="legend-toggle" onclick="toggleLegend()">
                    <span>ℹ️</span>
                </div>
                
                <!-- Legend -->
                <div class="legend" id="legend">
                    <div class="legend-header">
                        <div class="legend-title">Compatibility Status</div>
                        <span class="legend-close" onclick="toggleLegend()">×</span>
                    </div>
                    <div class="legend-items">
                        <div class="legend-item">
                            <div class="legend-color pulse" style="background: #4CAF50;"></div>
                            <span><strong>Widely Available</strong> - Use freely</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-color" style="background: #FFC107;"></div>
                            <span><strong>Newly Available</strong> - Check targets</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-color" style="background: #F44336;"></div>
                            <span><strong>Limited Support</strong> - Use fallbacks</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-color" style="background: #9E9E9E;"></div>
                            <span><strong>Unknown</strong> - Research needed</span>
                        </div>
                    </div>
                </div>
                
                <!-- Graph Stats -->
                <div class="graph-stats">
                    <div class="stat-row">
                        <span class="stat-label">Total Features:</span>
                        <span class="stat-value" id="total-features">0</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Widely Available:</span>
                        <span class="stat-value" id="widely-count">0</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Limited Support:</span>
                        <span class="stat-value" id="limited-count">0</span>
                    </div>
                </div>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                const canvas = document.getElementById('canvas');
                const ctx = canvas.getContext('2d');
                
                // Graph data from extension
                const graphData = ${JSON.stringify(graphData)};
                let currentMode = 'compatibility';
                let selectedNode = null;
                let hoveredNode = null;
                let camera = { x: 0, y: 0, zoom: 1 };
                let isDragging = false;
                let dragStart = { x: 0, y: 0 };
                
                // Canvas setup
                function resizeCanvas() {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                }
                resizeCanvas();
                window.addEventListener('resize', resizeCanvas);
                
                // Main render loop
                function render() {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.save();
                    
                    // Apply camera transform
                    ctx.translate(canvas.width / 2 + camera.x, canvas.height / 2 + camera.y);
                    ctx.scale(camera.zoom, camera.zoom);
                    
                    // Draw edges first
                    graphData.edges.forEach(edge => {
                        drawEdge(edge);
                    });
                    
                    // Draw nodes
                    graphData.nodes.forEach(node => {
                        drawNode(node);
                    });
                    
                    ctx.restore();
                    requestAnimationFrame(render);
                }
                
                function drawNode(node) {
                    const { x, y, radius, color, label, status } = node;
                    
                    // Set alpha based on dimmed state
                    const alpha = node.dimmed ? 0.3 : 1.0;  // Dimmed nodes are 30% opacity
                    ctx.globalAlpha = alpha;
                    
                    // Draw node circle
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                    
                    // Draw border for selected/hovered (only if not dimmed)
                    if (node === selectedNode) {
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 3;
                        ctx.stroke();
                    } else if (node === hoveredNode && !node.dimmed) {
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                    
                    // Draw label
                    ctx.fillStyle = '#fff';
                    ctx.font = \`\${Math.max(12, radius / 2)}px Inter, system-ui, sans-serif\`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // Truncate long labels
                    let displayLabel = label;
                    if (label.length > 15) {
                        displayLabel = label.substring(0, 12) + '...';
                    }
                    
                    // Draw text with shadow for readability
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                    ctx.shadowBlur = 4;
                    ctx.fillText(displayLabel, x, y);
                    ctx.shadowBlur = 0;
                    
                    // Draw status indicator
                    if (status) {
                        const statusRadius = radius / 4;
                        const statusX = x + radius - statusRadius;
                        const statusY = y - radius + statusRadius;
                        
                        ctx.beginPath();
                        ctx.arc(statusX, statusY, statusRadius, 0, Math.PI * 2);
                        ctx.fillStyle = getStatusColor(status);
                        ctx.fill();
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                    
                    // Reset alpha to default
                    ctx.globalAlpha = 1.0;
                }
                
                function drawEdge(edge) {
                    const { from, to, type, strength } = edge;
                    
                    // Dim the edge if either connected node is dimmed
                    const isDimmed = from.dimmed || to.dimmed;
                    const alpha = isDimmed ? 0.1 : 1.0; // Make dimmed edges barely visible
                    ctx.globalAlpha = alpha;
                    
                    ctx.beginPath();
                    ctx.moveTo(from.x, from.y);
                    
                    if (type === 'alternative') {
                        // Dashed line for alternatives
                        ctx.setLineDash([5, 5]);
                        ctx.strokeStyle = 'rgba(102, 126, 234, 0.5)';
                        ctx.lineWidth = 2;
                    } else if (type === 'upgrade') {
                        // Arrow for upgrades
                        ctx.setLineDash([]);
                        ctx.strokeStyle = 'rgba(76, 175, 80, 0.5)';
                        ctx.lineWidth = 2;
                        
                        // Draw arrow
                        const angle = Math.atan2(to.y - from.y, to.x - from.x);
                        const arrowLength = 10;
                        const arrowAngle = Math.PI / 6;
                        
                        ctx.lineTo(to.x, to.y);
                        ctx.stroke();
                        
                        ctx.beginPath();
                        ctx.moveTo(to.x, to.y);
                        ctx.lineTo(
                            to.x - arrowLength * Math.cos(angle - arrowAngle),
                            to.y - arrowLength * Math.sin(angle - arrowAngle)
                        );
                        ctx.moveTo(to.x, to.y);
                        ctx.lineTo(
                            to.x - arrowLength * Math.cos(angle + arrowAngle),
                            to.y - arrowLength * Math.sin(angle + arrowAngle)
                        );
                    } else {
                        // Normal edge
                        ctx.setLineDash([]);
                        ctx.strokeStyle = \`rgba(255, 255, 255, \${0.1 + strength * 0.4})\`;
                        ctx.lineWidth = 1 + strength * 2;
                    }
                    
                    ctx.lineTo(to.x, to.y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    
                    // Reset alpha to default
                    ctx.globalAlpha = 1.0;
                }
                
                function getStatusColor(status) {
                    switch(status) {
                        case 'widely': return '#4CAF50';
                        case 'newly': return '#FFC107';
                        case 'limited': return '#F44336';
                        default: return '#9E9E9E';
                    }
                }
                
                // Mouse interactions
                canvas.addEventListener('mousemove', (e) => {
                    const rect = canvas.getBoundingClientRect();
                    const x = (e.clientX - rect.left - canvas.width / 2 - camera.x) / camera.zoom;
                    const y = (e.clientY - rect.top - canvas.height / 2 - camera.y) / camera.zoom;
                    
                    if (isDragging) {
                        camera.x = e.clientX - dragStart.x;
                        camera.y = e.clientY - dragStart.y;
                    } else {
                        // Check hover
                        hoveredNode = null;
                        graphData.nodes.forEach(node => {
                            const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
                            if (dist < node.radius) {
                                hoveredNode = node;
                                canvas.style.cursor = 'pointer';
                            }
                        });
                        
                        if (!hoveredNode) {
                            canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
                        }
                    }
                });
                
                canvas.addEventListener('mousedown', (e) => {
                    if (!hoveredNode) {
                        isDragging = true;
                        dragStart = {
                            x: e.clientX - camera.x,
                            y: e.clientY - camera.y
                        };
                        canvas.style.cursor = 'grabbing';
                    }
                });
                
                canvas.addEventListener('mouseup', () => {
                    isDragging = false;
                    canvas.style.cursor = 'grab';
                });
                
                canvas.addEventListener('click', (e) => {
                    if (hoveredNode) {
                        selectNode(hoveredNode);
                    }
                });
                
                canvas.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? 0.9 : 1.1;
                    camera.zoom = Math.max(0.5, Math.min(3, camera.zoom * delta));
                });
                
                // Node selection
                function selectNode(node) {
                    selectedNode = node;
                    
                    // Update UI
                    const featureEl = document.getElementById('selected-feature');
                    featureEl.style.display = 'block';
                    featureEl.querySelector('.feature-name').textContent = node.label;
                    featureEl.querySelector('.feature-status').textContent = node.status || 'Unknown';
                    featureEl.querySelector('.feature-status').className = \`feature-status status-\${node.status}\`;
                    
                    // Show browser support
                    const browserGrid = featureEl.querySelector('.browser-grid');
                    browserGrid.innerHTML = '';
                    if (node.browsers) {
                        Object.entries(node.browsers).forEach(([browser, version]) => {
                            const chip = document.createElement('div');
                            chip.className = 'browser-chip';
                            chip.textContent = \`\${browser}: \${version}+\`;
                            browserGrid.appendChild(chip);
                        });
                    }
                    
                    // Request feature details from extension
                    vscode.postMessage({
                        command: 'getFeatureDetails',
                        featureId: node.id
                    });
                    
                    // Highlight connected nodes
                    highlightConnections(node);
                }
                
                function highlightConnections(node) {
                    // Dim all nodes
                    graphData.nodes.forEach(n => {
                        n.dimmed = true;
                    });
                    
                    // Highlight selected and connected
                    node.dimmed = false;
                    graphData.edges.forEach(edge => {
                        if (edge.from === node || edge.to === node) {
                            edge.from.dimmed = false;
                            edge.to.dimmed = false;
                            edge.highlighted = true;
                        } else {
                            edge.highlighted = false;
                        }
                    });
                }
                
                // View mode switching
                document.querySelectorAll('.view-mode').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        document.querySelectorAll('.view-mode').forEach(b => b.classList.remove('active'));
                        e.target.classList.add('active');
                        currentMode = e.target.dataset.mode;
                        reorganizeGraph(currentMode);
                    });
                });
                
                function reorganizeGraph(mode) {
                    switch(mode) {
                        case 'compatibility':
                            // Group by support level
                            layoutByCompatibility();
                            break;
                        case 'categories':
                            // Group by feature category
                            layoutByCategory();
                            break;
                        case 'timeline':
                            // Arrange by release date
                            layoutByTimeline();
                            break;
                    }
                }
                
                function layoutByCompatibility() {
                    const groups = {
                        widely: [],
                        newly: [],
                        limited: [],
                        unknown: []
                    };
                    
                    graphData.nodes.forEach(node => {
                        const group = groups[node.status] || groups.unknown;
                        group.push(node);
                    });
                    
                    // Position nodes in concentric circles
                    let radius = 100;
                    Object.entries(groups).forEach(([status, nodes], groupIndex) => {
                        nodes.forEach((node, i) => {
                            const angle = (i / nodes.length) * Math.PI * 2;
                            node.x = Math.cos(angle) * radius * (groupIndex + 1);
                            node.y = Math.sin(angle) * radius * (groupIndex + 1);
                        });
                    });
                }
                
                function layoutByCategory() {
                    const categories = {};
                    graphData.nodes.forEach(node => {
                        const cat = node.category || 'other';
                        if (!categories[cat]) categories[cat] = [];
                        categories[cat].push(node);
                    });
                    
                    // Grid layout for categories
                    const cols = Math.ceil(Math.sqrt(Object.keys(categories).length));
                    let catIndex = 0;
                    
                    Object.entries(categories).forEach(([cat, nodes]) => {
                        const col = catIndex % cols;
                        const row = Math.floor(catIndex / cols);
                        const baseX = (col - cols / 2) * 300;
                        const baseY = (row - 2) * 300;
                        
                        nodes.forEach((node, i) => {
                            const angle = (i / nodes.length) * Math.PI * 2;
                            node.x = baseX + Math.cos(angle) * 80;
                            node.y = baseY + Math.sin(angle) * 80;
                        });
                        catIndex++;
                    });
                }
                
                function layoutByTimeline() {
                    // Sort by baseline date
                    const sorted = [...graphData.nodes].sort((a, b) => {
                        const dateA = new Date(a.baselineDate || '2000-01-01');
                        const dateB = new Date(b.baselineDate || '2000-01-01');
                        return dateA - dateB;
                    });
                    
                    // Timeline layout
                    sorted.forEach((node, i) => {
                        node.x = (i - sorted.length / 2) * 50;
                        node.y = Math.sin(i * 0.5) * 100; // Wave pattern
                    });
                }
                
                // Search functionality
                document.getElementById('search').addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase();
                    
                    if (query.length > 0) {
                        graphData.nodes.forEach(node => {
                            node.dimmed = !node.label.toLowerCase().includes(query);
                        });
                    } else {
                        graphData.nodes.forEach(node => {
                            node.dimmed = false;
                        });
                    }
                });
                
                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'showDetails':
                            showRecommendations(message.feature, message.similar);
                            break;
                        case 'showPath':
                            visualizePath(message.path);
                            break;
                    }
                });
                
                function showRecommendations(feature, similar) {
                    const container = document.getElementById('recommendations');
                    container.style.display = 'block';
                    container.innerHTML = '<div style="font-weight: 600; margin-bottom: 10px;">💡 Recommendations</div>';
                    
                    similar.slice(0, 3).forEach(rec => {
                        const card = document.createElement('div');
                        card.className = 'recommendation-card';
                        card.innerHTML = \`
                            <div style="font-weight: 600;">\${rec.name || rec.id}</div>
                            <div style="font-size: 12px; opacity: 0.7; margin-top: 4px;">
                                \${rec.status?.baseline || 'Unknown'} • Click to explore
                            </div>
                        \`;
                        card.onclick = () => {
                            const node = graphData.nodes.find(n => n.id === rec.id);
                            if (node) selectNode(node);
                        };
                        container.appendChild(card);
                    });
                }
                
                function resetView() {
                    camera = { x: 0, y: 0, zoom: 1 };
                    selectedNode = null;
                    graphData.nodes.forEach(node => {
                        node.dimmed = false;
                    });
                    document.getElementById('selected-feature').style.display = 'none';
                    document.getElementById('recommendations').style.display = 'none';
                }
                

                
                function toggleLegend() {
                    const legend = document.getElementById('legend');
                    legend.classList.toggle('show');
                }
                
                // Update stats
                document.getElementById('total-features').textContent = graphData.nodes.length;
                document.getElementById('widely-count').textContent = 
                    graphData.nodes.filter(n => n.status === 'widely').length;
                document.getElementById('limited-count').textContent = 
                    graphData.nodes.filter(n => n.status === 'limited').length;
                
                // Initialize layout
                layoutByCompatibility();
                
                // Start render loop
                render();
                
                // Initially hide the legend
                setTimeout(() => {
                    const legend = document.getElementById('legend');
                    if (legend) {
                        legend.classList.remove('show');
                    }
                }, 100);
            </script>
        </body>
        </html>`;
    }

    private async buildMeaningfulGraph(features: any[]): Promise<any> {
        // Create ACTUAL USEFUL relationships
        const nodes: any[] = [];
        const edges: any[] = [];
        const nodeMap = new Map();

        // Build alternative mappings (what can replace what)
        const alternatives: Record<string, string[]> = {
            'subgrid': ['grid', 'flexbox'],
            'container-queries': ['media-queries', 'clamp', 'viewport-units'],
            'css-has': ['css-not', 'css-is', 'css-where'],
            'backdrop-filter': ['filter', 'background-blur'],
            'gap': ['margin', 'padding', 'spacer-elements'],
            'aspect-ratio': ['padding-hack', 'viewport-units'],
            'scroll-snap': ['scroll-behavior', 'intersection-observer'],
            'css-nesting': ['sass-nesting', 'postcss'],
            'cascade-layers': ['css-specificity', 'important'],
            'color-mix': ['css-variables', 'preprocessor-functions']
        };

        // Build upgrade paths (old -> new)
        const upgrades: Record<string, string> = {
            'flexbox': 'grid',
            'float': 'flexbox',
            'table-layout': 'grid',
            'css-variables': 'css-custom-properties',
            'webkit-transform': 'transform',
            'moz-border-radius': 'border-radius'
        };

        // Process features and create nodes
        features.slice(0, 100).forEach(feature => {
            const status = this.getStatus(feature);
            const node = {
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

        // Create MEANINGFUL edges

        // 1. Alternative relationships
        Object.entries(alternatives).forEach(([limited, betterOptions]) => {
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

        // 2. Upgrade paths
        Object.entries(upgrades).forEach(([old, newer]) => {
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

        // 3. Category relationships (features that work well together)
        const categoryGroups = new Map<string, any[]>();
        nodes.forEach(node => {
            if (!categoryGroups.has(node.category)) {
                categoryGroups.set(node.category, []);
            }
            categoryGroups.get(node.category)!.push(node);
        });

        categoryGroups.forEach(group => {
            // Connect some features within same category
            for (let i = 0; i < Math.min(group.length - 1, 3); i++) {
                edges.push({
                    from: group[i],
                    to: group[i + 1],
                    type: 'related',
                    strength: 0.3
                });
            }
        });

        return { nodes, edges };
    }

    private getStatus(feature: any): { key: string; label: string; color: string; size: number } {
        const baseline = feature.status?.baseline || feature.status?.baseline_status;

        switch (baseline) {
            case 'widely':
            case 'high':
                return {
                    key: 'widely',
                    label: 'Widely Available',
                    color: '#4CAF50',
                    size: 25
                };
            case 'newly':
            case 'low':
                return {
                    key: 'newly',
                    label: 'Newly Available',
                    color: '#FFC107',
                    size: 20
                };
            case 'limited':
            case false:
                return {
                    key: 'limited',
                    label: 'Limited Support',
                    color: '#F44336',
                    size: 15
                };
            default:
                return {
                    key: 'unknown',
                    label: 'Unknown',
                    color: '#9E9E9E',
                    size: 12
                };
        }
    }
    public async showProjectGraph() {
        if (this.panel) {
            this.panel.dispose();
        }

        this.panel = vscode.window.createWebviewPanel(
            'projectGraph',
            'Your Project\'s Feature Graph',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const analyzer = new ProjectAnalyzer(this.index);
        const analysis = await analyzer.analyzeProject();

        this.panel.webview.html = await this.getProjectGraphHtml(analysis);

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private async getProjectGraphHtml(analysis: ProjectAnalysis): Promise<string> {
        // Build graph data from project analysis
        const nodes: any[] = [];
        const edges: any[] = [];

        // Create nodes for each feature used in the project
        analysis.features.forEach((projectFeature, featureId) => {
            const status = this.getStatus(projectFeature.feature);
            nodes.push({
                id: featureId,
                label: projectFeature.feature.name || featureId,
                x: (Math.random() - 0.5) * 600,
                y: (Math.random() - 0.5) * 400,
                radius: Math.min(10 + projectFeature.usageCount * 2, 40), // Size based on usage
                color: status.color,
                status: status.key,
                usageCount: projectFeature.usageCount,
                fileCount: projectFeature.files.length,
                files: projectFeature.files,
                risk: status.key === 'limited' || status.key === 'newly'
            });
        });

        // Create edges between features used in same files
        const fileFeatureMap = new Map<string, string[]>();
        analysis.features.forEach((pf, featureId) => {
            pf.files.forEach(file => {
                if (!fileFeatureMap.has(file)) {
                    fileFeatureMap.set(file, []);
                }
                fileFeatureMap.get(file)!.push(featureId);
            });
        });

        // Connect features used in same files
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

        const graphData = { nodes, edges };
        const scoreColor = analysis.compatibilityScore >= 90 ? '#4CAF50'
            : analysis.compatibilityScore >= 70 ? '#FFC107'
                : '#F44336';

        return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Project's Feature Graph</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                color: white;
                overflow: hidden;
            }
            
            #container {
                width: 100vw;
                height: 100vh;
                position: relative;
            }
            
            #canvas {
                width: 100%;
                height: 100%;
            }
            
            /* Project Score Card */
            .score-card {
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(10px);
                padding: 24px;
                border-radius: 16px;
                text-align: center;
                min-width: 200px;
                border: 2px solid ${scoreColor};
            }
            
            .score-title {
                font-size: 14px;
                opacity: 0.8;
                margin-bottom: 10px;
            }
            
            .score-value {
                font-size: 48px;
                font-weight: bold;
                color: ${scoreColor};
                margin-bottom: 10px;
            }
            
            .score-label {
                font-size: 16px;
                color: ${scoreColor};
            }
            
            /* Control Panel */
            #controls {
                position: absolute;
                top: 20px;
                left: 20px;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(10px);
                padding: 24px;
                border-radius: 16px;
                width: 400px;
                max-height: 90vh;
                overflow-y: auto;
            }
            
            .header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 20px;
            }
            
            .title {
                font-size: 24px;
                font-weight: 600;
            }
            
            /* Search with fixed functionality */
            .search-container {
                position: relative;
                margin-bottom: 20px;
            }
            
            #search {
                width: 100%;
                padding: 12px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                color: white;
                font-size: 14px;
                outline: none;
            }
            
            #search:focus {
                background: rgba(255, 255, 255, 0.15);
                border-color: ${scoreColor};
            }
            
            /* Feature Analysis */
            .analysis-section {
                margin-bottom: 20px;
            }
            
            .section-title {
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .feature-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .feature-item {
                background: rgba(255, 255, 255, 0.05);
                padding: 10px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s;
                border: 1px solid transparent;
            }
            
            .feature-item:hover {
                background: rgba(255, 255, 255, 0.1);
                transform: translateX(4px);
            }
            
            .feature-item.selected {
                border-color: ${scoreColor};
                background: rgba(255, 255, 255, 0.15);
            }
            
            .feature-name {
                font-weight: 600;
                margin-bottom: 4px;
            }
            
            .feature-meta {
                font-size: 12px;
                opacity: 0.8;
                display: flex;
                gap: 12px;
            }
            
            .risk-badge {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
            }
            
            .risk-high {
                background: rgba(244, 67, 54, 0.3);
                color: #F44336;
            }
            
            .risk-medium {
                background: rgba(255, 193, 7, 0.3);
                color: #FFC107;
            }
            
            .risk-low {
                background: rgba(76, 175, 80, 0.3);
                color: #4CAF50;
            }
            
            /* Suggestions */
            .suggestions {
                background: rgba(102, 126, 234, 0.1);
                border: 1px solid rgba(102, 126, 234, 0.3);
                border-radius: 8px;
                padding: 12px;
                margin-top: 20px;
            }
            
            .suggestion-item {
                margin-bottom: 8px;
                font-size: 13px;
                line-height: 1.4;
            }
            
            /* Legend */
            .legend {
                position: absolute;
                bottom: 20px;
                left: 20px;
                background: rgba(0, 0, 0, 0.8);
                padding: 16px;
                border-radius: 8px;
                font-size: 12px;
            }
            
            .legend-item {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 6px;
            }
            
            .legend-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
            }
            
            /* Tooltip */
            #tooltip {
                position: absolute;
                background: rgba(0, 0, 0, 0.9);
                padding: 12px;
                border-radius: 8px;
                font-size: 13px;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s;
                z-index: 1000;
                max-width: 300px;
            }
            
            #tooltip.visible {
                opacity: 1;
            }
            
            /* Export button */
            .export-btn {
                width: 100%;
                padding: 12px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                cursor: pointer;
                margin-top: 20px;
                transition: all 0.3s;
            }
            
            .export-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
        </style>
    </head>
    <body>
        <div id="container">
            <canvas id="canvas"></canvas>
            
            <!-- Score Card -->
            <div class="score-card">
                <div class="score-title">Compatibility Score</div>
                <div class="score-value">${analysis.compatibilityScore}</div>
                <div class="score-label">
                    ${analysis.compatibilityScore >= 90 ? 'Excellent'
                : analysis.compatibilityScore >= 70 ? 'Good'
                    : 'Needs Work'}
                </div>
            </div>
            
            <!-- Control Panel -->
            <div id="controls">
                <div class="header">
                    <span style="font-size: 32px;">📊</span>
                    <div class="title">Your Project Analysis</div>
                </div>
                
                <!-- Search -->
                <div class="search-container">
                    <input type="text" id="search" placeholder="Search your features..." />
                </div>
                
                <!-- Risk Features -->
                ${analysis.riskFeatures.length > 0 ? `
                <div class="analysis-section">
                    <div class="section-title">
                        <span>⚠️</span>
                        <span>Features Needing Attention (${analysis.riskFeatures.length})</span>
                    </div>
                    <div class="feature-list">
                        ${analysis.riskFeatures.slice(0, 5).map(rf => `
                            <div class="feature-item" data-id="${rf.feature.id}">
                                <div class="feature-name">
                                    ${rf.feature.name || rf.feature.id}
                                    <span class="risk-badge risk-high">LIMITED</span>
                                </div>
                                <div class="feature-meta">
                                    <span>📝 ${rf.usageCount} uses</span>
                                    <span>📁 ${rf.files.length} files</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                <!-- Safe Features -->
                <div class="analysis-section">
                    <div class="section-title">
                        <span>✅</span>
                        <span>Widely Supported Features (${analysis.safeFeatures.length})</span>
                    </div>
                    <div class="feature-list">
                        ${analysis.safeFeatures.slice(0, 5).map(sf => `
                            <div class="feature-item" data-id="${sf.feature.id}">
                                <div class="feature-name">
                                    ${sf.feature.name || sf.feature.id}
                                    <span class="risk-badge risk-low">SAFE</span>
                                </div>
                                <div class="feature-meta">
                                    <span>📝 ${sf.usageCount} uses</span>
                                    <span>📁 ${sf.files.length} files</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Suggestions -->
                <div class="suggestions">
                    <div style="font-weight: 600; margin-bottom: 8px;">💡 Suggestions</div>
                    ${analysis.suggestions.map(s => `
                        <div class="suggestion-item">${s}</div>
                    `).join('')}
                </div>
                

            </div>
            
            <!-- Legend -->
            <div class="legend">
                <div class="legend-item">
                    <div class="legend-dot" style="background: #4CAF50;"></div>
                    <span>Widely Supported (Safe to use)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-dot" style="background: #FFC107;"></div>
                    <span>Newly Available (Check targets)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-dot" style="background: #F44336;"></div>
                    <span>Limited Support (Need fallbacks)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-dot" style="background: #9E9E9E;"></div>
                    <span>Unknown Status</span>
                </div>
            </div>
            
            <!-- Tooltip -->
            <div id="tooltip"></div>
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            const graphData = ${JSON.stringify(graphData)};
            const analysisData = ${JSON.stringify({
                        compatibilityScore: analysis.compatibilityScore,
                        totalFeatures: analysis.features.size,
                        riskCount: analysis.riskFeatures.length,
                        safeCount: analysis.safeFeatures.length
                    })};
            
            let selectedNode = null;
            let hoveredNode = null;
            let camera = { x: 0, y: 0, zoom: 1 };
            let isDragging = false;
            let dragStart = { x: 0, y: 0 };
            let searchQuery = '';
            
            // Physics simulation
            let simulation = {
                nodes: graphData.nodes,
                edges: graphData.edges,
                running: true
            };
            
            // Initialize node positions in a circle
            const angleStep = (Math.PI * 2) / simulation.nodes.length;
            simulation.nodes.forEach((node, i) => {
                const angle = i * angleStep;
                const radius = 200;
                node.x = Math.cos(angle) * radius;
                node.y = Math.sin(angle) * radius;
                node.vx = 0;
                node.vy = 0;
            });
            
            // Canvas setup
            function resizeCanvas() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);
            
            // Physics update
            function updatePhysics() {
                if (!simulation.running) return;
                
                const damping = 0.95;
                const repulsion = 5000;
                const attraction = 0.001;
                
                // Apply forces
                simulation.nodes.forEach(node => {
                    node.fx = 0;
                    node.fy = 0;
                    
                    // Repulsion between nodes
                    simulation.nodes.forEach(other => {
                        if (node === other) return;
                        const dx = node.x - other.x;
                        const dy = node.y - other.y;
                        const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
                        const force = repulsion / (dist * dist);
                        node.fx += (dx / dist) * force;
                        node.fy += (dy / dist) * force;
                    });
                    
                    // Center attraction
                    node.fx -= node.x * attraction;
                    node.fy -= node.y * attraction;
                });
                
                // Apply edge constraints
                simulation.edges.forEach(edge => {
                    const dx = edge.to.x - edge.from.x;
                    const dy = edge.to.y - edge.from.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const targetDist = 150;
                    const force = (dist - targetDist) * 0.01;
                    
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    
                    edge.from.fx += fx;
                    edge.from.fy += fy;
                    edge.to.fx -= fx;
                    edge.to.fy -= fy;
                });
                
                // Update positions
                simulation.nodes.forEach(node => {
                    if (node.fixed) return;
                    node.vx = (node.vx + node.fx) * damping;
                    node.vy = (node.vy + node.fy) * damping;
                    node.x += node.vx;
                    node.y += node.vy;
                });
            }
            
            // Render loop
            function render() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.save();
                
                // Apply camera
                ctx.translate(canvas.width / 2 + camera.x, canvas.height / 2 + camera.y);
                ctx.scale(camera.zoom, camera.zoom);
                
                // Update physics
                updatePhysics();
                
                // Draw edges
                simulation.edges.forEach(edge => {
                    const highlighted = (selectedNode === edge.from || selectedNode === edge.to);
                    drawEdge(edge, highlighted);
                });
                
                // Draw nodes
                simulation.nodes.forEach(node => {
                    const highlighted = node === selectedNode || 
                                      (searchQuery && node.label.toLowerCase().includes(searchQuery));
                    drawNode(node, highlighted);
                });
                
                ctx.restore();
                requestAnimationFrame(render);
            }
            
            function drawNode(node, highlighted) {
                const { x, y, radius, color, label, usageCount, risk } = node;
                
                // Fade out if searching and not matching
                const opacity = searchQuery && !highlighted ? 0.3 : 1;
                
                // Draw glow for risky features
                if (risk && opacity > 0.5) {
                    ctx.beginPath();
                    ctx.arc(x, y, radius + 10, 0, Math.PI * 2);
                    const gradient = ctx.createRadialGradient(x, y, radius, x, y, radius + 10);
                    gradient.addColorStop(0, \`\${color}66\`);
                    gradient.addColorStop(1, 'transparent');
                    ctx.fillStyle = gradient;
                    ctx.fill();
                }
                
                // Draw node
                ctx.globalAlpha = opacity;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                
                // Border for selected/hovered
                if (node === selectedNode || node === hoveredNode) {
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = highlighted ? 3 : 2;
                    ctx.stroke();
                }
                
                // Draw label
                ctx.fillStyle = '#fff';
                ctx.font = \`\${12}px Inter, system-ui, sans-serif\`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 4;
                
                // Show usage count
                ctx.fillText(label, x, y - 5);
                ctx.font = '10px Inter, system-ui, sans-serif';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fillText(\`\${usageCount} uses\`, x, y + 8);
                
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
            }
            
            function drawEdge(edge, highlighted) {
                ctx.globalAlpha = highlighted ? 0.6 : 0.2;
                ctx.beginPath();
                ctx.moveTo(edge.from.x, edge.from.y);
                ctx.lineTo(edge.to.x, edge.to.y);
                ctx.strokeStyle = highlighted ? '#667eea' : 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = highlighted ? 2 : 1;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
            
            // Search functionality (FIXED)
            document.getElementById('search').addEventListener('input', (e) => {
                searchQuery = e.target.value.toLowerCase();
                
                // Highlight matching features in the list
                document.querySelectorAll('.feature-item').forEach(item => {
                    const name = item.querySelector('.feature-name').textContent.toLowerCase();
                    if (searchQuery && name.includes(searchQuery)) {
                        item.classList.add('selected');
                    } else {
                        item.classList.remove('selected');
                    }
                });
            });
            
            // Feature item clicks
            document.querySelectorAll('.feature-item').forEach(item => {
                item.addEventListener('click', () => {
                    const featureId = item.dataset.id;
                    const node = simulation.nodes.find(n => n.id === featureId);
                    if (node) {
                        selectedNode = node;
                        // Zoom to node
                        camera.x = -node.x * camera.zoom;
                        camera.y = -node.y * camera.zoom;
                        camera.zoom = 1.5;
                    }
                });
            });
            
            // Mouse interactions
            canvas.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                const x = (e.clientX - rect.left - canvas.width / 2 - camera.x) / camera.zoom;
                const y = (e.clientY - rect.top - canvas.height / 2 - camera.y) / camera.zoom;
                
                if (isDragging) {
                    camera.x = e.clientX - dragStart.x;
                    camera.y = e.clientY - dragStart.y;
                } else {
                    // Find hovered node
                    hoveredNode = null;
                    const tooltip = document.getElementById('tooltip');
                    
                    simulation.nodes.forEach(node => {
                        const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
                        if (dist < node.radius) {
                            hoveredNode = node;
                            
                            // Show tooltip
                            tooltip.innerHTML = \`
                                <strong>\${node.label}</strong><br>
                                Status: \${node.status}<br>
                                Usage: \${node.usageCount} times<br>
                                Files: \${node.fileCount}<br>
                                Risk: \${node.risk ? 'Yes' : 'No'}
                            \`;
                            tooltip.style.left = e.clientX + 10 + 'px';
                            tooltip.style.top = e.clientY + 10 + 'px';
                            tooltip.classList.add('visible');
                            canvas.style.cursor = 'pointer';
                        }
                    });
                    
                    if (!hoveredNode) {
                        tooltip.classList.remove('visible');
                        canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
                    }
                }
            });
            
            canvas.addEventListener('mousedown', (e) => {
                if (!hoveredNode) {
                    isDragging = true;
                    dragStart = { x: e.clientX - camera.x, y: e.clientY - camera.y };
                } else {
                    selectedNode = hoveredNode;
                    selectedNode.fixed = true;
                }
            });
            
            canvas.addEventListener('mouseup', () => {
                isDragging = false;
                if (selectedNode) {
                    selectedNode.fixed = false;
                }
            });
            
            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                camera.zoom = Math.max(0.3, Math.min(3, camera.zoom * delta));
            });
            

            
            // Start render loop
            render();
            
            // Stop physics after initial layout
            setTimeout(() => {
                simulation.running = false;
            }, 5000);
        </script>
    </body>
    </html>`;
    }
}