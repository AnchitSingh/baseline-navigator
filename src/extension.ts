import * as vscode from 'vscode';
import { InvertedIndex } from './core/InvertedIndex';
import { RecommendationEngine } from './core/RecommendationEngine';
import { ConfigurationManager } from './core/ConfigurationManager';
import { BaselineHoverProvider } from './providers/HoverProvider';
import { BaselineCodeActionProvider } from './providers/CodeActionProvider';
import { BaselineDiagnosticProvider } from './providers/DiagnosticProvider';
import { GraphView } from './views/GraphView';
import { ProjectAnalyzer, ProjectAnalysis } from './core/ProjectAnalyzer';

let diagnosticProvider: BaselineDiagnosticProvider;
let configManager: ConfigurationManager;

// Helper function to generate detailed report
function generateDetailedReport(analysis: ProjectAnalysis): string {
    let report = `# Baseline Compatibility Report\n\n`;
    report += `Generated: ${analysis.timestamp.toISOString()}\n\n`;
    
    const config = configManager.getConfiguration();
    report += `## Configuration\n`;
    report += `- **Target Browsers**: ${config.targetBrowsers.join(', ')}\n`;
    report += `- **Risk Tolerance**: ${config.riskTolerance}\n\n`;
    
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
        // Initialize configuration manager
        configManager = ConfigurationManager.getInstance();
        const config = configManager.getConfiguration();
        
        if (!config.enabled) {
            console.log('Baseline Navigator is disabled in settings');
            return;
        }
        
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
            return;
        }
        
        // Initialize providers (conditionally based on config)
        const hoverProvider = new BaselineHoverProvider(index, configManager);
        const codeActionProvider = new BaselineCodeActionProvider(index, configManager);
        diagnosticProvider = new BaselineDiagnosticProvider(index, configManager);
        
        // Initialize views
        const graphView = new GraphView(context.extensionUri, index);
        
        // Register providers
        if (config.enableHoverInfo) {
            context.subscriptions.push(
                vscode.languages.registerHoverProvider(
                    ['css', 'scss', 'less', 'sass', 'javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'html'],
                    hoverProvider
                )
            );
        }
        
        if (config.enableCodeActions) {
            context.subscriptions.push(
                vscode.languages.registerCodeActionsProvider(
                    ['css', 'scss', 'less', 'sass', 'javascript', 'typescript'],
                    codeActionProvider
                )
            );
        }
        
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
            vscode.commands.registerCommand('baseline-navigator.configure', async () => {
                await configManager.configure();
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
                        'Export Report',
                        'Configure'
                    );
                    
                    if (action === 'View Details') {
                        vscode.commands.executeCommand('baseline-navigator.analyzeProject');
                    } else if (action === 'Export Report') {
                        const report = generateDetailedReport(analysis);
                        const doc = await vscode.workspace.openTextDocument({
                            content: report,
                            language: 'markdown'
                        });
                        await vscode.window.showTextDocument(doc);
                    } else if (action === 'Configure') {
                        vscode.commands.executeCommand('baseline-navigator.configure');
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
        
        // Auto-check on save (if enabled)
        if (config.checkOnSave) {
            context.subscriptions.push(
                vscode.workspace.onDidSaveTextDocument(async (document) => {
                    await diagnosticProvider.updateDiagnostics(document);
                })
            );
        }
        
        // Listen for configuration changes
        configManager.onDidChange((newConfig) => {
            console.log('Configuration changed:', newConfig);
            
            // Refresh diagnostics if active editor
            if (vscode.window.activeTextEditor) {
                diagnosticProvider.updateDiagnostics(vscode.window.activeTextEditor.document);
            }
        });
        
        // Check active editor on activation
        if (vscode.window.activeTextEditor) {
            diagnosticProvider.updateDiagnostics(vscode.window.activeTextEditor.document);
        }
        
        // Status bar item with configuration indicator
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.text = `$(telescope) Baseline [${config.riskTolerance}]`;
        statusBarItem.tooltip = 'Baseline Navigator - Click to explore features';
        statusBarItem.command = 'baseline-navigator.showGraph';
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);
        
        // Update status bar on config change
        configManager.onDidChange((newConfig) => {
            statusBarItem.text = `$(telescope) Baseline [${newConfig.riskTolerance}]`;
        });
        
        console.log('✨ Baseline Navigator is ready!');
        
        // Show welcome message with configuration option
        const showWelcome = context.globalState.get('baseline.welcomeShown', false);
        if (!showWelcome) {
            const action = await vscode.window.showInformationMessage(
                'Baseline Navigator is ready! Configure your browser targets for personalized compatibility checks.',
                'Configure Now',
                'Later'
            );
            
            if (action === 'Configure Now') {
                await configManager.configure();
            }
            
            context.globalState.update('baseline.welcomeShown', true);
        }
        
    } catch (error) {
        console.error('Failed to activate Baseline Navigator:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to activate Baseline Navigator: ${errorMessage}`);
    }
}

export function deactivate() {
    if (diagnosticProvider) {
        diagnosticProvider.dispose();
    }
    console.log('Baseline Navigator deactivated');
}

function getFeatureDetailsHtml(feature: any): string {
    const config = configManager.getConfiguration();
    const targetBrowsers = config.targetBrowsers;
    
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
                border: 2px solid transparent;
            }
            .browser-card.target {
                border-color: var(--vscode-focusBorder);
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
            .target-info {
                background: var(--vscode-textBlockQuote-background);
                border-left: 4px solid var(--vscode-focusBorder);
                padding: 10px;
                margin: 15px 0;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <h1>${feature.name || feature.id}</h1>
        <div class="status ${feature.status?.baseline || 'unknown'}">
            ${feature.status?.baseline || 'Unknown Status'}
        </div>
        
        <p>${feature.description || 'No description available'}</p>
        
        <div class="target-info">
            <strong>Your Target Browsers:</strong> ${targetBrowsers.join(', ')}
        </div>
        
        ${feature.status?.support ? `
            <h2>Browser Support</h2>
            <div class="browser-grid">
                ${Object.entries(feature.status.support).map(([browser, version]) => `
                    <div class="browser-card ${targetBrowsers.includes(browser) ? 'target' : ''}">
                        <strong>${browser}</strong><br>
                        Version ${version}+
                        ${targetBrowsers.includes(browser) ? '<br><small>✓ Targeted</small>' : ''}
                    </div>
                `).join('')}
            </div>
        ` : ''}
        
        <div class="links">
            ${feature.mdn_url ? `<a href="${feature.mdn_url}">📚 MDN Documentation</a>` : ''}
            ${feature.caniuse ? `<a href="https://caniuse.com/${feature.caniuse}">🔍 Can I Use</a>` : ''}
        </div>
    </body>
    </html>`;
}