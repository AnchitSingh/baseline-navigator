import * as vscode from 'vscode';
import { InvertedIndex } from '../core/InvertedIndex';
import { RecommendationEngine } from '../core/RecommendationEngine';
import { ProjectAnalyzer } from '../core/ProjectAnalyzer';
import { GraphDataBuilder } from './graph/builders/GraphDataBuilder';
import { ProjectGraphBuilder } from './graph/builders/ProjectGraphBuilder';
import { CompatibilityMapTemplate } from './graph/templates/CompatibilityMapTemplate';
import { ProjectGraphTemplate } from './graph/templates/ProjectGraphTemplate';

export class GraphView {
    private panel: vscode.WebviewPanel | undefined;
    private graphDataBuilder: GraphDataBuilder;
    private projectGraphBuilder: ProjectGraphBuilder;
    private recommendationEngine: RecommendationEngine;

    constructor(
        private extensionUri: vscode.Uri,
        private index: InvertedIndex
    ) {
        this.graphDataBuilder = new GraphDataBuilder();
        this.projectGraphBuilder = new ProjectGraphBuilder();
        this.recommendationEngine = new RecommendationEngine(index);
    }

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
        this.setupMessageHandling();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
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
        const template = new ProjectGraphTemplate();

        this.panel.webview.html = template.generate(analysis);

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private async getHtmlContent(): Promise<string> {
        try {
            await this.index.waitForReady();
        } catch (error) {
            console.error('Failed to generate HTML content: Index not ready', error);
            return this.getErrorHtmlContent();
        }

        const features = this.index.getAllFeatures();
        const graphData = await this.graphDataBuilder.buildMeaningfulGraph(features);
        const template = new CompatibilityMapTemplate();

        return template.generate(graphData);
    }

    private setupMessageHandling(): void {
        this.panel?.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'getFeatureDetails':
                    await this.handleFeatureDetailsRequest(message);
                    break;
                case 'getRecommendations':
                    await this.handleRecommendationsRequest(message);
                    break;
            }
        });
    }

    private async handleFeatureDetailsRequest(message: any): Promise<void> {
        const feature = this.index.getFeature(message.featureId);
        
        if (!feature) {
            console.error(`Feature not found: ${message.featureId}`);
            this.panel?.webview.postMessage({
                command: 'showDetails',
                error: 'Feature not found'
            });
            return;
        }

        // Get basic similar features for context
        const similar = await this.index.getSimilarFeatures(message.featureId);

        this.panel?.webview.postMessage({
            command: 'showDetails',
            feature: feature,
            similar: similar.slice(0, 5)
        });
    }

    private async handleRecommendationsRequest(message: any): Promise<void> {
        const feature = this.index.getFeature(message.featureId);
        
        if (!feature) {
            console.error(`Feature not found: ${message.featureId}`);
            return;
        }

        console.log(`Getting recommendations for: ${message.featureId}`);

        // Use the enhanced recommendation engine
        const recommendations = await this.recommendationEngine.getRecommendations({
            currentFeature: message.featureId,
            documentLanguage: message.languageId || 'css',
            targetBrowsers: message.targetBrowsers || ['chrome', 'firefox', 'safari', 'edge']
        });

        console.log(`Found ${recommendations.length} recommendations`);

        // Transform recommendations for the webview
        const transformedRecs = recommendations.map(rec => ({
            feature: {
                id: rec.feature.id,
                name: rec.feature.name || rec.feature.id,
                description: rec.feature.description,
                status: rec.feature.status
            },
            reason: rec.reason,
            confidence: rec.confidence,
            type: rec.type || 'related',
            alternatives: rec.alternatives?.map(alt => ({
                id: alt.id,
                name: alt.name || alt.id
            })) || []
        }));

        this.panel?.webview.postMessage({
            command: 'showRecommendations',
            featureId: message.featureId,
            recommendations: transformedRecs
        });
    }

    private getErrorHtmlContent(): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Error</title>
            <style>
                body {
                    font-family: sans-serif;
                    background: #0d1117;
                    color: #c9d1d9;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .error-container {
                    text-align: center;
                }
                h1 { color: #f44336; }
            </style>
        </head>
        <body>
            <div class="error-container">
                <div style="font-size: 48px;">⚠️</div>
                <h1>Feature Database Error</h1>
                <p>The baseline feature database failed to load.</p>
            </div>
        </body>
        </html>`;
    }
}