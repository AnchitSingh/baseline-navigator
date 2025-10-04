import * as vscode from 'vscode';
import { InvertedIndex } from '../core/InvertedIndex';
import { ProjectAnalyzer } from '../core/ProjectAnalyzer';
import { GraphDataBuilder } from './graph/builders/GraphDataBuilder';
import { ProjectGraphBuilder } from './graph/builders/ProjectGraphBuilder';
import { CompatibilityMapTemplate } from './graph/templates/CompatibilityMapTemplate';
import { ProjectGraphTemplate } from './graph/templates/ProjectGraphTemplate';

export class GraphView {
    private panel: vscode.WebviewPanel | undefined;
    private graphDataBuilder: GraphDataBuilder;
    private projectGraphBuilder: ProjectGraphBuilder;

    constructor(
        private extensionUri: vscode.Uri,
        private index: InvertedIndex
    ) {
        this.graphDataBuilder = new GraphDataBuilder();
        this.projectGraphBuilder = new ProjectGraphBuilder();
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
                    const feature = this.index.getFeature(message.featureId);
                    const similar = await this.index.getSimilarFeatures(message.featureId);
                    this.panel?.webview.postMessage({
                        command: 'showDetails',
                        feature,
                        similar
                    });
                    break;
            }
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