import { GraphData } from '../types';

export class CompatibilityMapTemplate {
    generate(graphData: GraphData): string {
        const stats = this.calculateStats(graphData);
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Baseline Compatibility Map</title>
            <style>${this.getStyles()}</style>
        </head>
        <body>
            <div id="container">
                <canvas id="canvas"></canvas>
                ${this.getControlPanel()}
                ${this.getLegend()}
                ${this.getStats(stats)}
                ${this.getTutorial()}
            </div>
            <script>
                ${this.getScript(graphData)}
            </script>
        </body>
        </html>`;
    }

    private calculateStats(graphData: GraphData) {
        return {
            total: graphData.nodes.length,
            widely: graphData.nodes.filter(n => n.status === 'widely').length,
            newly: graphData.nodes.filter(n => n.status === 'newly').length,
            limited: graphData.nodes.filter(n => n.status === 'limited').length,
            unknown: graphData.nodes.filter(n => n.status === 'unknown').length
        };
    }

    private getTutorial(): string {
        return `
            <div id="tutorial" class="tutorial-overlay">
                <div class="tutorial-content">
                    <h2>🎯 Welcome to Feature Explorer!</h2>
                    <div class="tutorial-steps">
                        <div class="tutorial-step">
                            <span class="step-icon">🖱️</span>
                            <div>
                                <strong>Drag to pan</strong>
                                <p>Click and drag on the canvas to move around</p>
                            </div>
                        </div>
                        <div class="tutorial-step">
                            <span class="step-icon">🔍</span>
                            <div>
                                <strong>Scroll to zoom</strong>
                                <p>Use mouse wheel to zoom in/out</p>
                            </div>
                        </div>
                        <div class="tutorial-step">
                            <span class="step-icon">👆</span>
                            <div>
                                <strong>Click nodes</strong>
                                <p>Click on any feature to see details and recommendations</p>
                            </div>
                        </div>
                        <div class="tutorial-step">
                            <span class="step-icon">🔎</span>
                            <div>
                                <strong>Search features</strong>
                                <p>Type in the search box to highlight matching features</p>
                            </div>
                        </div>
                    </div>
                    <button class="tutorial-close" onclick="closeTutorial()">Got it!</button>
                </div>
            </div>
        `;
    }

    private getStyles(): string {
        return `
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
                cursor: grab;
            }
            
            #canvas.dragging {
                cursor: grabbing;
            }
            
            /* Tutorial Overlay */
            .tutorial-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.3s;
            }
            
            .tutorial-overlay.hidden {
                display: none;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .tutorial-content {
                background: linear-gradient(135deg, #1a1f2e 0%, #221f3a 100%);
                padding: 40px;
                border-radius: 20px;
                max-width: 600px;
                border: 2px solid rgba(102, 126, 234, 0.5);
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            }
            
            .tutorial-content h2 {
                margin-bottom: 24px;
                font-size: 28px;
                text-align: center;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            
            .tutorial-steps {
                display: flex;
                flex-direction: column;
                gap: 20px;
                margin-bottom: 30px;
            }
            
            .tutorial-step {
                display: flex;
                gap: 16px;
                align-items: flex-start;
            }
            
            .step-icon {
                font-size: 32px;
                min-width: 40px;
            }
            
            .tutorial-step strong {
                display: block;
                font-size: 16px;
                margin-bottom: 4px;
            }
            
            .tutorial-step p {
                font-size: 14px;
                opacity: 0.8;
                line-height: 1.5;
            }
            
            .tutorial-close {
                width: 100%;
                padding: 14px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                border-radius: 10px;
                color: white;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .tutorial-close:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
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
                max-height: 85vh;
                overflow-y: auto;
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
            
            #search::placeholder {
                color: rgba(255, 255, 255, 0.4);
            }
            
            .search-icon {
                position: absolute;
                right: 16px;
                top: 50%;
                transform: translateY(-50%);
                opacity: 0.5;
            }
            
            /* Selected Feature Panel */
            #selected-feature {
                background: rgba(255, 255, 255, 0.03);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 20px;
                border: 1px solid rgba(255, 255, 255, 0.05);
                display: none;
            }
            
            #selected-feature.visible {
                display: block;
                animation: slideIn 0.3s;
            }
            
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .feature-name {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 8px;
                color: #fff;
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
                background: rgba(76, 175, 80, 0.3);
                color: #4CAF50;
                border: 1px solid #4CAF50;
            }
            
            .status-newly {
                background: rgba(255, 193, 7, 0.3);
                color: #FFC107;
                border: 1px solid #FFC107;
            }
            
            .status-limited, .status-unknown {
                background: rgba(244, 67, 54, 0.3);
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
            #recommendations {
                margin-top: 20px;
                display: none;
            }
            
            #recommendations.visible {
                display: block;
            }
            
            .recommendations-title {
                font-weight: 600;
                margin-bottom: 10px;
                font-size: 14px;
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
            
            .recommendation-name {
                font-weight: 600;
                margin-bottom: 4px;
            }
            
            .recommendation-info {
                font-size: 12px;
                opacity: 0.7;
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
                width: 20px;
                height: 20px;
                border-radius: 50%;
            }
            
            /* Stats */
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
                gap: 20px;
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
                grid-template-columns: 1fr;
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
            
            .action-btn.secondary {
                background: rgba(255, 255, 255, 0.1);
            }
            
            /* Scrollbar */
            #controls::-webkit-scrollbar {
                width: 6px;
            }
            
            #controls::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 3px;
            }
            
            #controls::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 3px;
            }
            
            #controls::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.3);
            }
        `;
    }

    private getControlPanel(): string {
        return `
            <div id="controls">
                <div class="control-header">
                    <span style="font-size: 28px;">🗺️</span>
                    <div class="control-title">Feature Compatibility Map</div>
                </div>
                
                <div class="view-modes">
                    <div class="view-mode active" data-mode="compatibility">🎯 Compatibility</div>
                    <div class="view-mode" data-mode="categories">📦 Categories</div>
                    <div class="view-mode" data-mode="timeline">📅 Timeline</div>
                </div>
                
                <div id="search-container">
                    <input type="text" id="search" placeholder="Search features (e.g., grid, flexbox)..." />
                    <span class="search-icon">🔍</span>
                </div>
                
                <div id="selected-feature">
                    <div class="feature-name"></div>
                    <div class="feature-status"></div>
                    <div class="browser-grid"></div>
                </div>
                
                <div id="recommendations">
                    <div class="recommendations-title">💡 Recommendations</div>
                    <div id="recommendations-list"></div>
                </div>
                
                <div class="action-buttons">
                    <button class="action-btn" onclick="resetView()">🔄 Reset View</button>
                    <button class="action-btn secondary" onclick="showTutorial()">❓ Show Help</button>
                </div>
            </div>
        `;
    }

    private getLegend(): string {
        return `
            <div class="legend">
                <div class="legend-title">Compatibility Status</div>
                <div class="legend-items">
                    <div class="legend-item">
                        <div class="legend-color" style="background: #4CAF50;"></div>
                        <span><strong>Widely Available</strong></span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #FFC107;"></div>
                        <span><strong>Newly Available</strong></span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #F44336;"></div>
                        <span><strong>Limited Support</strong></span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #F44336;"></div>
                        <span><strong>Unknown</strong></span>
                    </div>
                </div>
            </div>
        `;
    }

    private getStats(stats: any): string {
        return `
            <div class="graph-stats">
                <div class="stat-row">
                    <span class="stat-label">Total Features:</span>
                    <span class="stat-value">${stats.total}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Widely Available:</span>
                    <span class="stat-value">${stats.widely}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Newly Available:</span>
                    <span class="stat-value">${stats.newly}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Limited/Unknown:</span>
                    <span class="stat-value">${stats.limited + stats.unknown}</span>
                </div>
            </div>
        `;
    }

    private getScript(graphData: GraphData): string {
        return `
            const vscode = acquireVsCodeApi();
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            const graphData = ${JSON.stringify(graphData)};
            
            let selectedNode = null;
            let hoveredNode = null;
            let camera = { x: 0, y: 0, zoom: 1 };
            let isDragging = false;
            let dragStart = { x: 0, y: 0 };
            let currentMode = 'compatibility';
            let searchQuery = '';
            
            // Canvas setup
            function resizeCanvas() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);
            
            // Tutorial functions
            function closeTutorial() {
                document.getElementById('tutorial').classList.add('hidden');
                localStorage.setItem('baselineTutorialSeen', 'true');
            }
            
            function showTutorial() {
                document.getElementById('tutorial').classList.remove('hidden');
            }
            
            // Check if tutorial should show
            if (!localStorage.getItem('baselineTutorialSeen')) {
                showTutorial();
            } else {
                closeTutorial();
            }
            
            // Main render loop
            function render() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.save();
                
                ctx.translate(canvas.width / 2 + camera.x, canvas.height / 2 + camera.y);
                ctx.scale(camera.zoom, camera.zoom);
                
                // Draw edges
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
                const { x, y, radius, color, label } = node;
                
                // Determine if node should be highlighted
                const isSearchMatch = searchQuery && label.toLowerCase().includes(searchQuery);
                const shouldDim = searchQuery && !isSearchMatch;
                const alpha = shouldDim ? 0.2 : 1.0;
                
                ctx.globalAlpha = alpha;
                
                // Highlight search matches
                if (isSearchMatch) {
                    ctx.beginPath();
                    ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
                    const gradient = ctx.createRadialGradient(x, y, radius, x, y, radius + 8);
                    gradient.addColorStop(0, color + 'AA');
                    gradient.addColorStop(1, color + '00');
                    ctx.fillStyle = gradient;
                    ctx.fill();
                }
                
                // Draw node circle
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                
                // Border for selected/hovered
                if (node === selectedNode) {
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                } else if (node === hoveredNode && !shouldDim) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                
                // Draw label
                ctx.fillStyle = '#fff';
                ctx.font = \`\${Math.max(12, radius / 2)}px Inter, system-ui, sans-serif\`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                let displayLabel = label;
                if (label.length > 15) {
                    displayLabel = label.substring(0, 12) + '...';
                }
                
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 4;
                ctx.fillText(displayLabel, x, y);
                ctx.shadowBlur = 0;
                
                ctx.globalAlpha = 1.0;
            }
            
            function drawEdge(edge) {
                const { from, to, type } = edge;
                
                // Dim edge if either node is dimmed
                const shouldDim = searchQuery && 
                    !from.label.toLowerCase().includes(searchQuery) && 
                    !to.label.toLowerCase().includes(searchQuery);
                const alpha = shouldDim ? 0.05 : 0.3;
                
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                
                if (type === 'alternative') {
                    ctx.setLineDash([5, 5]);
                    ctx.strokeStyle = 'rgba(102, 126, 234, 0.5)';
                    ctx.lineWidth = 2;
                } else if (type === 'upgrade') {
                    ctx.setLineDash([]);
                    ctx.strokeStyle = 'rgba(76, 175, 80, 0.5)';
                    ctx.lineWidth = 2;
                } else {
                    ctx.setLineDash([]);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.lineWidth = 1;
                }
                
                ctx.lineTo(to.x, to.y);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 1.0;
            }
            
            // Mouse interactions - FIX: Proper drag handling
            canvas.addEventListener('mousedown', (e) => {
                if (hoveredNode) {
                    selectNode(hoveredNode);
                } else {
                    isDragging = true;
                    dragStart = {
                        x: e.clientX - camera.x,
                        y: e.clientY - camera.y
                    };
                    canvas.classList.add('dragging');
                }
            });
            
            canvas.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                const x = (e.clientX - rect.left - canvas.width / 2 - camera.x) / camera.zoom;
                const y = (e.clientY - rect.top - canvas.height / 2 - camera.y) / camera.zoom;
                
                if (isDragging) {
                    // FIX: Proper camera update during drag
                    camera.x = e.clientX - dragStart.x;
                    camera.y = e.clientY - dragStart.y;
                } else {
                    // Check hover
                    hoveredNode = null;
                    graphData.nodes.forEach(node => {
                        const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
                        if (dist < node.radius) {
                            hoveredNode = node;
                        }
                    });
                    
                    canvas.style.cursor = hoveredNode ? 'pointer' : 'grab';
                }
            });
            
            canvas.addEventListener('mouseup', () => {
                isDragging = false;
                canvas.classList.remove('dragging');
                canvas.style.cursor = 'grab';
            });
            
            canvas.addEventListener('mouseleave', () => {
                isDragging = false;
                canvas.classList.remove('dragging');
            });
            
            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                camera.zoom = Math.max(0.5, Math.min(3, camera.zoom * delta));
            });
            
            // Node selection - FIX: Show proper details
            function selectNode(node) {
                selectedNode = node;
                
                const featureEl = document.getElementById('selected-feature');
                featureEl.classList.add('visible');
                
                featureEl.querySelector('.feature-name').textContent = node.label;
                
                const statusEl = featureEl.querySelector('.feature-status');
                statusEl.textContent = node.status.charAt(0).toUpperCase() + node.status.slice(1);
                statusEl.className = \`feature-status status-\${node.status}\`;
                
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
                } else {
                    browserGrid.innerHTML = '<div class="browser-chip" style="grid-column: 1/-1;">Browser data not available</div>';
                }
                
                // Request recommendations
                vscode.postMessage({
                    command: 'getFeatureDetails',
                    featureId: node.id
                });
            }
            
            // Search functionality - FIX: Highlight matches instead of dimming everything
            document.getElementById('search').addEventListener('input', (e) => {
                searchQuery = e.target.value.toLowerCase().trim();
                
                if (!searchQuery) {
                    // Clear search
                    graphData.nodes.forEach(node => {
                        node.dimmed = false;
                    });
                }
                // The render loop will handle highlighting based on searchQuery
            });
            
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
                        layoutByCompatibility();
                        break;
                    case 'categories':
                        layoutByCategory();
                        break;
                    case 'timeline':
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
                const sorted = [...graphData.nodes].sort((a, b) => {
                    const dateA = new Date(a.baselineDate || '2000-01-01');
                    const dateB = new Date(b.baselineDate || '2000-01-01');
                    return dateA - dateB;
                });
                
                sorted.forEach((node, i) => {
                    node.x = (i - sorted.length / 2) * 50;
                    node.y = Math.sin(i * 0.5) * 100;
                });
            }
            
            // Handle messages from extension - FIX: Show recommendations properly
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'showDetails':
                        showRecommendations(message.feature, message.similar);
                        break;
                }
            });
            
            function showRecommendations(feature, similar) {
                const container = document.getElementById('recommendations');
                const listContainer = document.getElementById('recommendations-list');
                
                if (!similar || similar.length === 0) {
                    container.classList.remove('visible');
                    return;
                }
                
                container.classList.add('visible');
                listContainer.innerHTML = '';
                
                similar.slice(0, 5).forEach(rec => {
                    const card = document.createElement('div');
                    card.className = 'recommendation-card';
                    
                    const name = document.createElement('div');
                    name.className = 'recommendation-name';
                    name.textContent = rec.name || rec.id;
                    
                    const info = document.createElement('div');
                    info.className = 'recommendation-info';
                    const status = rec.status?.baseline || rec.status?.baseline_status || 'Unknown';
                    info.textContent = \`Status: \${status} • Click to explore\`;
                    
                    card.appendChild(name);
                    card.appendChild(info);
                    
                    card.onclick = () => {
                        const node = graphData.nodes.find(n => n.id === rec.id);
                        if (node) {
                            selectNode(node);
                            // Zoom to node
                            camera.x = -node.x * camera.zoom + canvas.width / 2 - 200;
                            camera.y = -node.y * camera.zoom + canvas.height / 2;
                            camera.zoom = 1.5;
                        }
                    };
                    
                    listContainer.appendChild(card);
                });
            }
            
            function resetView() {
                camera = { x: 0, y: 0, zoom: 1 };
                selectedNode = null;
                searchQuery = '';
                document.getElementById('search').value = '';
                document.getElementById('selected-feature').classList.remove('visible');
                document.getElementById('recommendations').classList.remove('visible');
                graphData.nodes.forEach(node => {
                    node.dimmed = false;
                });
                layoutByCompatibility();
            }
            
            // Initialize layout
            layoutByCompatibility();
            
            // Start render loop
            render();
        `;
    }
}