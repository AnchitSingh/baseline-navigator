import * as vscode from 'vscode';

export interface BrowserTarget {
    browser: string;
    version: string;
}

export interface BaselineConfiguration {
    enabled: boolean;
    checkOnSave: boolean;
    targetBrowsers: string[];
    minimumBrowserVersions: Record<string, string>;
    riskTolerance: 'strict' | 'moderate' | 'permissive';
    showRecommendations: boolean;
    maxRecommendations: number;
    diagnosticSeverity: Record<string, string>;
    enableHoverInfo: boolean;
    enableCodeActions: boolean;
    cacheTimeout: number;
}

export class ConfigurationManager {
    private static instance: ConfigurationManager;
    private configuration: BaselineConfiguration;
    private onDidChangeEmitter = new vscode.EventEmitter<BaselineConfiguration>();
    
    public readonly onDidChange = this.onDidChangeEmitter.event;
    
    private constructor() {
        this.configuration = this.loadConfiguration();
        
        // Watch for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('baseline-navigator')) {
                this.configuration = this.loadConfiguration();
                this.onDidChangeEmitter.fire(this.configuration);
            }
        });
    }
    
    public static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }
    
    private loadConfiguration(): BaselineConfiguration {
        const config = vscode.workspace.getConfiguration('baseline-navigator');
        
        return {
            enabled: config.get('enabled', true),
            checkOnSave: config.get('checkOnSave', true),
            targetBrowsers: config.get('targetBrowsers', ['chrome', 'firefox', 'safari', 'edge']),
            minimumBrowserVersions: config.get('minimumBrowserVersions', {
                chrome: '90',
                firefox: '88',
                safari: '14',
                edge: '90'
            }),
            riskTolerance: config.get('riskTolerance', 'moderate'),
            showRecommendations: config.get('showRecommendations', true),
            maxRecommendations: config.get('maxRecommendations', 5),
            diagnosticSeverity: config.get('diagnosticSeverity', {
                limited: 'Warning',
                newly: 'Information'
            }),
            enableHoverInfo: config.get('enableHoverInfo', true),
            enableCodeActions: config.get('enableCodeActions', true),
            cacheTimeout: config.get('cacheTimeout', 300000)
        };
    }
    
    public getConfiguration(): BaselineConfiguration {
        return { ...this.configuration };
    }
    
    public async updateConfiguration(key: string, value: any, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
        const config = vscode.workspace.getConfiguration('baseline-navigator');
        await config.update(key, value, target);
    }
    
    public getBrowserTargets(): BrowserTarget[] {
        return this.configuration.targetBrowsers.map(browser => ({
            browser,
            version: this.configuration.minimumBrowserVersions[browser] || '0'
        }));
    }
    
    public shouldWarnForFeature(baseline: string | boolean | undefined): boolean {
        const tolerance = this.configuration.riskTolerance;
        
        if (baseline === 'widely' || baseline === 'high') {
            return false; // Never warn for widely supported
        }
        
        if (baseline === 'limited' || baseline === false) {
            return true; // Always warn for limited support
        }
        
        if (baseline === 'newly' || baseline === 'low') {
            // Warn based on risk tolerance
            return tolerance === 'strict';
        }
        
        return tolerance !== 'permissive'; // Unknown features
    }
    
    public getDiagnosticSeverity(baseline: string): vscode.DiagnosticSeverity {
        const severityMap = this.configuration.diagnosticSeverity;
        const severityString = severityMap[baseline] || 'Information';
        
        switch (severityString) {
            case 'Error':
                return vscode.DiagnosticSeverity.Error;
            case 'Warning':
                return vscode.DiagnosticSeverity.Warning;
            case 'Information':
                return vscode.DiagnosticSeverity.Information;
            case 'Hint':
                return vscode.DiagnosticSeverity.Hint;
            default:
                return vscode.DiagnosticSeverity.Information;
        }
    }
    
    public async configure(): Promise<void> {
        const options = [
            {
                label: '🎯 Target Browsers',
                description: 'Configure which browsers to target',
                action: () => this.configureBrowsers()
            },
            {
                label: '⚠️ Risk Tolerance',
                description: 'Set how strict compatibility warnings should be',
                action: () => this.configureRiskTolerance()
            },
            {
                label: '💡 Recommendations',
                description: 'Configure feature recommendations',
                action: () => this.configureRecommendations()
            },
            {
                label: '🔧 Advanced Settings',
                description: 'Open settings.json',
                action: () => vscode.commands.executeCommand('workbench.action.openSettings', 'baseline-navigator')
            }
        ];
        
        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'What would you like to configure?'
        });
        
        if (selected) {
            await selected.action();
        }
    }
    
    private async configureBrowsers(): Promise<void> {
        const allBrowsers = [
            { label: 'Chrome', value: 'chrome' },
            { label: 'Firefox', value: 'firefox' },
            { label: 'Safari', value: 'safari' },
            { label: 'Edge', value: 'edge' },
            { label: 'Opera', value: 'opera' },
            { label: 'Samsung Internet', value: 'samsung_internet' }
        ];
        
        const currentBrowsers = this.configuration.targetBrowsers;
        
        const selected = await vscode.window.showQuickPick(
            allBrowsers.map(b => ({
                label: b.label,
                value: b.value,
                picked: currentBrowsers.includes(b.value)
            })),
            {
                canPickMany: true,
                placeHolder: 'Select target browsers'
            }
        );
        
        if (selected) {
            const browsers = selected.map(s => s.value);
            await this.updateConfiguration('targetBrowsers', browsers);
            
            // Ask for minimum versions
            for (const browser of browsers) {
                const currentVersion = this.configuration.minimumBrowserVersions[browser] || '90';
                const version = await vscode.window.showInputBox({
                    prompt: `Minimum ${browser} version`,
                    value: currentVersion,
                    validateInput: (value) => {
                        return /^\d+$/.test(value) ? null : 'Please enter a valid version number';
                    }
                });
                
                if (version) {
                    const versions = { ...this.configuration.minimumBrowserVersions };
                    versions[browser] = version;
                    await this.updateConfiguration('minimumBrowserVersions', versions);
                }
            }
            
            vscode.window.showInformationMessage('Browser targets updated!');
        }
    }
    
    private async configureRiskTolerance(): Promise<void> {
        const options = [
            {
                label: '🔴 Strict',
                description: 'Warn about newly available features',
                value: 'strict'
            },
            {
                label: '🟡 Moderate',
                description: 'Only warn about limited support features',
                value: 'moderate'
            },
            {
                label: '🟢 Permissive',
                description: 'Only warn about unsupported features',
                value: 'permissive'
            }
        ];
        
        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select risk tolerance level'
        });
        
        if (selected) {
            await this.updateConfiguration('riskTolerance', selected.value);
            vscode.window.showInformationMessage(`Risk tolerance set to ${selected.label}`);
        }
    }
    
    private async configureRecommendations(): Promise<void> {
        const showRecs = await vscode.window.showQuickPick(
            [
                { label: 'Enable', value: true },
                { label: 'Disable', value: false }
            ],
            {
                placeHolder: 'Show feature recommendations?'
            }
        );
        
        if (showRecs) {
            await this.updateConfiguration('showRecommendations', showRecs.value);
            
            if (showRecs.value) {
                const max = await vscode.window.showInputBox({
                    prompt: 'Maximum number of recommendations',
                    value: String(this.configuration.maxRecommendations),
                    validateInput: (value) => {
                        const num = parseInt(value);
                        if (isNaN(num) || num < 1 || num > 10) {
                            return 'Please enter a number between 1 and 10';
                        }
                        return null;
                    }
                });
                
                if (max) {
                    await this.updateConfiguration('maxRecommendations', parseInt(max));
                }
            }
            
            vscode.window.showInformationMessage('Recommendation settings updated!');
        }
    }
}