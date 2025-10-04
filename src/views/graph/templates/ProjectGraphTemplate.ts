import { ProjectAnalysis } from '../../../core/ProjectAnalyzer';
import { GraphData } from '../types';
import { ProjectGraphBuilder } from '../builders/ProjectGraphBuilder';

export class ProjectGraphTemplate {
    private builder: ProjectGraphBuilder;

    constructor() {
        this.builder = new ProjectGraphBuilder();
    }

    generate(analysis: ProjectAnalysis): string {
        const graphData = this.builder.buildProjectGraph(analysis);
        const scoreColor = this.getScoreColor(analysis.compatibilityScore);

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Project's Feature Graph</title>
            <style>${this.getStyles(scoreColor)}</style>
        </head>
        <body>
            <div id="container">
                <canvas id="canvas"></canvas>
                ${this.getScoreCard(analysis, scoreColor)}
                ${this.getControlPanel(analysis)}
                ${this.getLegend()}
                <div id="tooltip"></div>
            </div>
            <script>${this.getScript(graphData, analysis)}</script>
        </body>
        </html>`;
    }

    private getScoreColor(score: number): string {
        if (score >= 90) return '#4CAF50';
        if (score >= 70) return '#FFC107';
        return '#F44336';
    }

    private getScoreLabel(score: number): string {
        if (score >= 90) return 'Excellent';
        if (score >= 70) return 'Good';
        return 'Needs Work';
    }

    private getStyles(scoreColor: string): string {
        return `
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
            
            /* Score Card */
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
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
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
                font-weight: 600;
            }
            
            .score-breakdown {
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid rgba(255, 255, 255, 0.2);
                text-align: left;
                font-size: 12px;
            }
            
            .score-item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
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
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
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
            
            /* Search */
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
                transition: all 0.3s;
            }
            
            #search:focus {
                background: rgba(255, 255, 255, 0.15);
                border-color: ${scoreColor};
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            
            #search::placeholder {
                color: rgba(255, 255, 255, 0.5);
            }
            
            /* Analysis Sections */
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
            
            .section-badge {
                background: rgba(255, 255, 255, 0.2);
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 12px;
                font-weight: 600;
            }
            
            /* Feature List */
            .feature-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .feature-item {
                background: rgba(255, 255, 255, 0.05);
                padding: 12px;
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
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .feature-meta {
                font-size: 12px;
                opacity: 0.8;
                display: flex;
                gap: 12px;
            }
            
            /* Risk Badges */
            .risk-badge {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
            }
            
            .risk-high {
                background: rgba(244, 67, 54, 0.3);
                color: #F44336;
                border: 1px solid #F44336;
            }
            
            .risk-medium {
                background: rgba(255, 193, 7, 0.3);
                color: #FFC107;
                border: 1px solid #FFC107;
            }
            
            .risk-low {
                background: rgba(76, 175, 80, 0.3);
                color: #4CAF50;
                border: 1px solid #4CAF50;
            }
            
            /* Suggestions */
            .suggestions {
                background: rgba(102, 126, 234, 0.15);
                border: 1px solid rgba(102, 126, 234, 0.3);
                border-radius: 8px;
                padding: 12px;
                margin-top: 20px;
            }
            
            .suggestions-title {
                font-weight: 600;
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .suggestion-item {
                margin-bottom: 8px;
                font-size: 13px;
                line-height: 1.5;
                padding-left: 16px;
                position: relative;
            }
            
            .suggestion-item:before {
                content: "→";
                position: absolute;
                left: 0;
                color: #667eea;
            }
            
            /* Legend */
            .legend {
                position: absolute;
                bottom: 20px;
                left: 20px;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(10px);
                padding: 16px;
                border-radius: 12px;
                font-size: 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .legend-title {
                font-weight: 600;
                margin-bottom: 10px;
                font-size: 13px;
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
                background: rgba(0, 0, 0, 0.95);
                padding: 12px;
                border-radius: 8px;
                font-size: 13px;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s;
                z-index: 1000;
                max-width: 300px;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            #tooltip.visible {
                opacity: 1;
            }
            
            .tooltip-title {
                font-weight: 600;
                margin-bottom: 6px;
                font-size: 14px;
            }
            
            .tooltip-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 4px;
                gap: 12px;
            }
            
            .tooltip-label {
                opacity: 0.7;
            }
            
            /* Export Button */
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
            
            /* Empty State */
            .empty-state {
                text-align: center;
                padding: 20px;
                opacity: 0.7;
                font-size: 14px;
            }
        `;
    }

    private getScoreCard(analysis: ProjectAnalysis, scoreColor: string): string {
        return `
            <div class="score-card">
                <div class="score-title">Compatibility Score</div>
                <div class="score-value">${analysis.compatibilityScore}</div>
                <div class="score-label">${this.getScoreLabel(analysis.compatibilityScore)}</div>
                
                <div class="score-breakdown">
                    <div class="score-item">
                        <span>Total Features:</span>
                        <strong>${analysis.features.size}</strong>
                    </div>
                    <div class="score-item">
                        <span>✅ Safe to Use:</span>
                        <strong style="color: #4CAF50">${analysis.safeFeatures.length}</strong>
                    </div>
                    <div class="score-item">
                        <span>⚠️ Need Attention:</span>
                        <strong style="color: #F44336">${analysis.riskFeatures.length}</strong>
                    </div>
                </div>
            </div>
        `;
    }

    private getControlPanel(analysis: ProjectAnalysis): string {
        return `
            <div id="controls">
                <div class="header">
                    <span style="font-size: 32px;">📊</span>
                    <div class="title">Your Project Analysis</div>
                </div>
                
                <!-- Search -->
                <div class="search-container">
                    <input type="text" id="search" placeholder="Search your features..." />
                </div>
                
                ${this.getRiskFeaturesSection(analysis)}
                ${this.getSafeFeaturesSection(analysis)}
                ${this.getSuggestionsSection(analysis)}
                
                <button class="export-btn" onclick="exportReport()">
                    📄 Export Report
                </button>
            </div>
        `;
    }

    private getRiskFeaturesSection(analysis: ProjectAnalysis): string {
        if (analysis.riskFeatures.length === 0) {
            return `
                <div class="analysis-section">
                    <div class="section-title">
                        <span>⚠️</span>
                        <span>Features Needing Attention</span>
                        <span class="section-badge">0</span>
                    </div>
                    <div class="empty-state">
                        🎉 Great! No risky features found.
                    </div>
                </div>
            `;
        }

        const features = analysis.riskFeatures.slice(0, 10).map(rf => `
            <div class="feature-item" data-id="${rf.feature.id}">
                <div class="feature-name">
                    ${this.truncateText(rf.feature.name || rf.feature.id, 30)}
                    <span class="risk-badge risk-high">LIMITED</span>
                </div>
                <div class="feature-meta">
                    <span>📝 ${rf.usageCount} use${rf.usageCount > 1 ? 's' : ''}</span>
                    <span>📁 ${rf.files.length} file${rf.files.length > 1 ? 's' : ''}</span>
                </div>
            </div>
        `).join('');

        const remaining = analysis.riskFeatures.length - 10;
        const moreText = remaining > 0 ? `
            <div class="empty-state" style="margin-top: 8px;">
                And ${remaining} more...
            </div>
        ` : '';

        return `
            <div class="analysis-section">
                <div class="section-title">
                    <span>⚠️</span>
                    <span>Features Needing Attention</span>
                    <span class="section-badge">${analysis.riskFeatures.length}</span>
                </div>
                <div class="feature-list">
                    ${features}
                </div>
                ${moreText}
            </div>
        `;
    }

    private getSafeFeaturesSection(analysis: ProjectAnalysis): string {
        if (analysis.safeFeatures.length === 0) {
            return '';
        }

        const features = analysis.safeFeatures.slice(0, 8).map(sf => `
            <div class="feature-item" data-id="${sf.feature.id}">
                <div class="feature-name">
                    ${this.truncateText(sf.feature.name || sf.feature.id, 30)}
                    <span class="risk-badge risk-low">SAFE</span>
                </div>
                <div class="feature-meta">
                    <span>📝 ${sf.usageCount} use${sf.usageCount > 1 ? 's' : ''}</span>
                    <span>📁 ${sf.files.length} file${sf.files.length > 1 ? 's' : ''}</span>
                </div>
            </div>
        `).join('');

        const remaining = analysis.safeFeatures.length - 8;
        const moreText = remaining > 0 ? `
            <div class="empty-state" style="margin-top: 8px;">
                And ${remaining} more safe features...
            </div>
        ` : '';

        return `
            <div class="analysis-section">
                <div class="section-title">
                    <span>✅</span>
                    <span>Widely Supported Features</span>
                    <span class="section-badge">${analysis.safeFeatures.length}</span>
                </div>
                <div class="feature-list">
                    ${features}
                </div>
                ${moreText}
            </div>
        `;
    }

    private getSuggestionsSection(analysis: ProjectAnalysis): string {
        if (analysis.suggestions.length === 0) {
            return '';
        }

        const suggestions = analysis.suggestions.map(s => `
            <div class="suggestion-item">${s}</div>
        `).join('');

        return `
            <div class="suggestions">
                <div class="suggestions-title">
                    💡 Suggestions
                </div>
                ${suggestions}
            </div>
        `;
    }

    private getLegend(): string {
        return `
            <div class="legend">
                <div class="legend-title">Feature Status</div>
                <div class="legend-item">
                    <div class="legend-dot" style="background: #4CAF50;"></div>
                    <span>Widely Supported (Safe)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-dot" style="background: #FFC107;"></div>
                    <span>Newly Available (Check)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-dot" style="background: #F44336;"></div>
                    <span>Limited/Unknown (Risk)</span>
                </div>
            </div>
        `;
    }

    private getScript(graphData: GraphData, analysis: ProjectAnalysis): string {
        return `
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
            
            // Initialize positions in a circle
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
                
                // Apply forces between nodes
                simulation.nodes.forEach(node => {
                    node.fx = 0;
                    node.fy = 0;
                    
                    // Repulsion
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
                
                // Edge constraints
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
                
                ctx.translate(canvas.width / 2 + camera.x, canvas.height / 2 + camera.y);
                ctx.scale(camera.zoom, camera.zoom);
                
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
                const opacity = searchQuery && !highlighted ? 0.3 : 1;
                
                // Glow for risky features
                if (risk && opacity > 0.5) {
                    ctx.beginPath();
                    ctx.arc(x, y, radius + 10, 0, Math.PI * 2);
                    const gradient = ctx.createRadialGradient(x, y, radius, x, y, radius + 10);
                    gradient.addColorStop(0, color + '66');
                    gradient.addColorStop(1, 'transparent');
                    ctx.fillStyle = gradient;
                    ctx.fill();
                }
                
                // Node circle
                ctx.globalAlpha = opacity;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                
                // Border
                if (node === selectedNode || node === hoveredNode) {
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = highlighted ? 3 : 2;
                    ctx.stroke();
                }
                
                // Label
                ctx.fillStyle = '#fff';
                ctx.font = '12px Inter, system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 4;
                
                let displayLabel = label;
                if (label.length > 20) {
                    displayLabel = label.substring(0, 17) + '...';
                }
                ctx.fillText(displayLabel, x, y - 5);
                
                // Usage count
                ctx.font = '10px Inter, system-ui, sans-serif';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fillText(usageCount + ' uses', x, y + 8);
                
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
            
            // Search functionality
            document.getElementById('search').addEventListener('input', (e) => {
                searchQuery = e.target.value.toLowerCase();
                
                // Highlight matching features
                document.querySelectorAll('.feature-item').forEach(item => {
                    const nameEl = item.querySelector('.feature-name');
                    if (!nameEl) return;
                    
                    const name = nameEl.textContent.toLowerCase();
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
                        camera.x = -node.x * camera.zoom + canvas.width / 2;
                        camera.y = -node.y * camera.zoom + canvas.height / 2;
                        camera.zoom = 1.5;
                        
                        // Scroll to feature in list
                        document.querySelectorAll('.feature-item').forEach(i => {
                            i.classList.remove('selected');
                        });
                        item.classList.add('selected');
                        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
                    hoveredNode = null;
                    const tooltip = document.getElementById('tooltip');
                    
                    simulation.nodes.forEach(node => {
                        const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
                        if (dist < node.radius) {
                            hoveredNode = node;
                            
                            tooltip.innerHTML = \`
                                <div class="tooltip-title">\${node.label}</div>
                                <div class="tooltip-row">
                                    <span class="tooltip-label">Status:</span>
                                    <strong>\${node.status}</strong>
                                </div>
                                <div class="tooltip-row">
                                    <span class="tooltip-label">Usage:</span>
                                    <strong>\${node.usageCount} times</strong>
                                </div>
                                <div class="tooltip-row">
                                    <span class="tooltip-label">Files:</span>
                                    <strong>\${node.fileCount}</strong>
                                </div>
                                <div class="tooltip-row">
                                    <span class="tooltip-label">Risk:</span>
                                    <strong style="color: \${node.risk ? '#F44336' : '#4CAF50'}">\${node.risk ? 'Yes' : 'No'}</strong>
                                </div>
                            \`;
                            tooltip.style.left = e.clientX + 15 + 'px';
                            tooltip.style.top = e.clientY + 15 + 'px';
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
            
            // Export report
            function exportReport() {
                const report = {
                    timestamp: new Date().toISOString(),
                    score: analysisData.compatibilityScore,
                    totalFeatures: analysisData.totalFeatures,
                    riskFeatures: analysisData.riskCount,
                    safeFeatures: analysisData.safeCount,
                    features: graphData.nodes.map(n => ({
                        id: n.id,
                        name: n.label,
                        status: n.status,
                        usageCount: n.usageCount,
                        fileCount: n.fileCount,
                        risk: n.risk
                    }))
                };
                
                vscode.postMessage({
                    command: 'exportReport',
                    report: report
                });
            }
            
            // Start render loop
            render();
            
            // Stop physics after initial layout
            setTimeout(() => {
                simulation.running = false;
            }, 5000);
        `;
    }

    private truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
}