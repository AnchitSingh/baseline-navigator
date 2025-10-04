import * as vscode from 'vscode';
import { InvertedIndex } from './core/InvertedIndex';
import { RecommendationEngine } from './core/RecommendationEngine';
import { BaselineHoverProvider } from './providers/HoverProvider';
import { BaselineCodeActionProvider } from './providers/CodeActionProvider';
import { BaselineDiagnosticProvider } from './providers/DiagnosticProvider';
import { GraphView } from './views/GraphView';
import { ProjectAnalyzer, ProjectAnalysis } from './core/ProjectAnalyzer';

let diagnosticProvider: BaselineDiagnosticProvider;

// Helper function to generate detailed report
function generateDetailedReport(analysis: ProjectAnalysis): string {
    let report = `# Baseline Compatibility Report\n\n`;
    report += `Generated: ${analysis.timestamp.toISOString()}\n\n`;
    
    report += `## Summary\n`;
    report += `- **Compatibility Score**: ${analysis.compatibilityScore}/100\n`;
    report += `- **Files Analyzed**: ${analysis.analyzedFiles}/${analysis.totalFiles}\n`;
    report += `- **Features Found**: ${analysis.features.size}\n`;
    report += `- **Risk Features**: ${analysis.riskFeatures.length}\n`;
    report += `- **Safe Features**: ${analysis.safeFeatures.length}\n\n`;
    
    report += `## Risk Features (Need Attention)\n`;
    if (analysis.riskFeatures.length > 0) {
        analysis.riskFeatures.forEach(rf => {
            report += `\n### ${rf.feature.name || rf.feature.id}\n`;
            report += `- **Status**: ${rf.feature.status?.baseline || 'Unknown'}\n`;
            report += `- **Usage Count**: ${rf.usageCount}\n`;
            report += `- **Files**: ${rf.files.join(', ')}\n`;
            if (rf.locations.length > 0 && rf.locations.length <= 5) {
                report += `- **Locations**:\n`;
                rf.locations.forEach(loc => {
                    report += `  - ${loc.file}:${loc.line}:${loc.column}\n`;
                });
            }
        });
    } else {
        report += `No risk features found.\n`;
    }
    
    report += `\n## Safe Features\n`;
    if (analysis.safeFeatures.length > 0) {
        analysis.safeFeatures.slice(0, 10).forEach(sf => {
            report += `- **${sf.feature.name || sf.feature.id}**: ${sf.usageCount} uses in ${sf.files.length} files\n`;
        });
    }
    
    report += `\n## Recommendations\n`;
    analysis.suggestions.forEach(suggestion => {
        report += `- ${suggestion}\n`;
    });
    
    return report;
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('🚀 Baseline Navigator is activating...');
    
    try {
        // Initialize core services
        const index = new InvertedIndex();
        const recommendationEngine = new RecommendationEngine(index);
        
        // Wait for index to be ready
        try {
            await index.waitForReady();
            console.log('✅ Index ready with features loaded');
        } catch (error) {
            console.error('Failed to initialize index:', error);
            vscode.window.showErrorMessage(`Baseline Navigator failed to initialize: ${error}`);
            return; // Exit activation if index doesn't load
        }
        
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
            vscode.commands.registerCommand('baseline-navigator.analyzeProject', async () => {
                await graphView.showProjectGraph();
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('baseline-navigator.quickProjectCheck', async () => {
                try {
                    const analyzer = new ProjectAnalyzer(index);
                    const analysis = await analyzer.analyzeProject();
                    
                    let message = `Compatibility Score: ${analysis.compatibilityScore}/100\n`;
                    message += `${analysis.riskFeatures.length} risky features found\n`;
                    message += `${analysis.safeFeatures.length} safe features used\n`;
                    message += `${analysis.analyzedFiles}/${analysis.totalFiles} files analyzed`;
                    
                    // Change message based on score
                    if (analysis.compatibilityScore >= 90) {
                        message = `✅ Excellent! ${message}`;
                    } else if (analysis.compatibilityScore >= 70) {
                        message = `⚠️ Good! ${message}`;
                    } else {
                        message = `⚠️ Attention needed! ${message}`;
                    }
                    
                    const action = await vscode.window.showInformationMessage(
                        message,
                        'View Details',
                        'Export Report'
                    );
                    
                    if (action === 'View Details') {
                        vscode.commands.executeCommand('baseline-navigator.analyzeProject');
                    } else if (action === 'Export Report') {
                        // Generate and show report
                        const report = generateDetailedReport(analysis);
                        const doc = await vscode.workspace.openTextDocument({
                            content: report,
                            language: 'markdown'
                        });
                        await vscode.window.showTextDocument(doc);
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    vscode.window.showErrorMessage(`Project analysis failed: ${errorMessage}`);
                    console.error('Project analysis error:', error);
                }
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('baseline-navigator.checkCompatibility', async () => {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    try {
                        await diagnosticProvider.updateDiagnostics(editor.document);
                        vscode.window.showInformationMessage('✅ Compatibility check complete');
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        vscode.window.showErrorMessage(`Compatibility check failed: ${errorMessage}`);
                        console.error('Diagnostic update error:', error);
                    }
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to activate Baseline Navigator: ${errorMessage}. Please check the console for details.`);
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