import * as vscode from 'vscode';
import { InvertedIndex } from './core/InvertedIndex';
import { RecommendationEngine } from './core/RecommendationEngine';
import { BaselineHoverProvider } from './providers/HoverProvider';
import { BaselineCodeActionProvider } from './providers/CodeActionProvider';
import { BaselineDiagnosticProvider } from './providers/DiagnosticProvider';
import { GraphView } from './views/GraphView';

let diagnosticProvider: BaselineDiagnosticProvider;

export async function activate(context: vscode.ExtensionContext) {
    console.log('🚀 Baseline Navigator is activating...');
    
    try {
        // Initialize core services
        const index = new InvertedIndex();
        const recommendationEngine = new RecommendationEngine(index);
        
        // Wait for index to be ready
        await index.waitForReady();
        console.log('✅ Index ready with features loaded');
        
        // Initialize providers
        const hoverProvider = new BaselineHoverProvider(index);
        const codeActionProvider = new BaselineCodeActionProvider(index);
        diagnosticProvider = new BaselineDiagnosticProvider(index);
        
        // Initialize views
        const graphView = new GraphView(context.extensionUri, index);
        
        // Register providers
        context.subscriptions.push(
            vscode.languages.registerHoverProvider(
                ['css', 'scss', 'less', 'sass', 'javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'html'],
                hoverProvider
            )
        );
        
        context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider(
                ['css', 'scss', 'less', 'sass', 'javascript', 'typescript'],
                codeActionProvider
            )
        );
        
        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('baseline-navigator.showGraph', () => {
                graphView.show();
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('baseline-navigator.checkCompatibility', async () => {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    await diagnosticProvider.updateDiagnostics(editor.document);
                    vscode.window.showInformationMessage('✅ Compatibility check complete');
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('baseline-navigator.showFeatureDetails', (feature) => {
                const panel = vscode.window.createWebviewPanel(
                    'featureDetails',
                    feature.name || feature.id,
                    vscode.ViewColumn.Two,
                    { enableScripts: true }
                );
                
                panel.webview.html = getFeatureDetailsHtml(feature);
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('baseline-navigator.findSimilar', async (featureId: string) => {
                const similar = await index.getSimilarFeatures(featureId);
                const quickPick = vscode.window.createQuickPick();
                quickPick.items = similar.map(f => ({
                    label: f.name || f.id,
                    description: f.status?.baseline || 'unknown',
                    detail: f.description
                }));
                quickPick.onDidChangeSelection(selection => {
                    if (selection[0]) {
                        vscode.commands.executeCommand('baseline-navigator.showFeatureDetails', 
                            similar.find(f => f.name === selection[0].label || f.id === selection[0].label)
                        );
                    }
                });
                quickPick.show();
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('baseline-navigator.openDocumentation', (feature) => {
                if (feature.mdn_url) {
                    vscode.env.openExternal(vscode.Uri.parse(feature.mdn_url));
                } else if (feature.caniuse) {
                    vscode.env.openExternal(vscode.Uri.parse(`https://caniuse.com/${feature.caniuse}`));
                } else {
                    vscode.window.showInformationMessage('No documentation URL available');
                }
            })
        );
        
        // Auto-check on save
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(async (document) => {
                const config = vscode.workspace.getConfiguration('baseline-navigator');
                if (config.get('checkOnSave', true)) {
                    await diagnosticProvider.updateDiagnostics(document);
                }
            })
        );
        
        // Check active editor on activation
        if (vscode.window.activeTextEditor) {
            diagnosticProvider.updateDiagnostics(vscode.window.activeTextEditor.document);
        }
        
        // Status bar item
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.text = '$(telescope) Baseline';
        statusBarItem.tooltip = 'Click to open Baseline Feature Explorer';
        statusBarItem.command = 'baseline-navigator.showGraph';
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);
        
        console.log('✨ Baseline Navigator is ready!');
        vscode.window.showInformationMessage('Baseline Navigator is ready! Click the status bar icon to explore features.');
        
    } catch (error) {
        console.error('Failed to activate Baseline Navigator:', error);
        vscode.window.showErrorMessage(`Failed to activate Baseline Navigator: ${error}`);
    }
}

export function deactivate() {
    if (diagnosticProvider) {
        diagnosticProvider.dispose();
    }
    console.log('Baseline Navigator deactivated');
}

function getFeatureDetailsHtml(feature: any): string {
    return `<!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                padding: 20px;
                line-height: 1.6;
                color: var(--vscode-foreground);
                background: var(--vscode-editor-background);
            }
            h1 { color: var(--vscode-foreground); }
            .status {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 4px;
                font-weight: 600;
                margin: 10px 0;
            }
            .status.widely { background: #4CAF50; color: white; }
            .status.newly { background: #FFC107; color: #333; }
            .status.limited { background: #F44336; color: white; }
            .browser-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 10px;
                margin: 20px 0;
            }
            .browser-card {
                padding: 10px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 6px;
                text-align: center;
            }
            .links {
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid var(--vscode-panel-border);
            }
            a {
                color: var(--vscode-textLink-foreground);
                text-decoration: none;
                margin-right: 15px;
            }
            a:hover {
                text-decoration: underline;
            }
        </style>
    </head>
    <body>
        <h1>${feature.name || feature.id}</h1>
        <div class="status ${feature.status?.baseline || 'unknown'}">
            ${feature.status?.baseline || 'Unknown Status'}
        </div>
        
        <p>${feature.description || 'No description available'}</p>
        
        ${feature.status?.support ? `
            <h2>Browser Support</h2>
            <div class="browser-grid">
                ${Object.entries(feature.status.support).map(([browser, version]) => `
                    <div class="browser-card">
                        <strong>${browser}</strong><br>
                        Version ${version}+
                    </div>
                `).join('')}
            </div>
        ` : ''}
        
        <div class="links">
            ${feature.mdn_url ? `<a href="${feature.mdn_url}">MDN Documentation</a>` : ''}
            ${feature.caniuse ? `<a href="https://caniuse.com/${feature.caniuse}">Can I Use</a>` : ''}
        </div>
    </body>
    </html>`;
}