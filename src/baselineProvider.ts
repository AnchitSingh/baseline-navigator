import * as vscode from 'vscode';

export class BaselineProvider implements vscode.HoverProvider {
    private featureMap: Map<string, any>;
    private featuresPromise: Promise<any>;

    constructor() {
        this.featureMap = new Map();
        // Use dynamic import for ES module
        this.featuresPromise = import('web-features').then(mod => {
            const features = mod.features;
            Object.entries(features).forEach(([id, feature]) => {
                this.featureMap.set(id, feature);
            });
            return features;
        });
    }

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Hover | undefined> {
        // Wait for features to load
        await this.featuresPromise;

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        const feature = this.searchFeature(word);

        if (feature) {
            const markdown = this.formatFeatureInfo(feature);
            return new vscode.Hover(markdown);
        }
    }

    private searchFeature(query: string): any {
    const lowerQuery = query.toLowerCase().trim();
    
    // Direct ID match (highest priority)
    if (this.featureMap.has(lowerQuery)) {
        return { id: lowerQuery, ...this.featureMap.get(lowerQuery) };
    }
    
    // Search in feature IDs and names
    for (const [id, feature] of this.featureMap) {
        const featureName = (feature as any).name?.toLowerCase() || '';
        
        // Exact match
        if (id === lowerQuery || featureName === lowerQuery) {
            return { id, ...feature };
        }
        
        // Partial match
        if (id.includes(lowerQuery) || featureName.includes(lowerQuery)) {
            return { id, ...feature };
        }
    }
    
    // Special CSS mappings (map CSS properties to feature IDs)
    const cssMapping: Record<string, string> = {
        'grid': 'grid',
        'flex': 'flexbox',
        'flexbox': 'flexbox',
        'var': 'css-variables',
        'subgrid': 'subgrid',
        'container': 'container-queries',
        '@container': 'container-queries',
        'aspect-ratio': 'aspect-ratio',
        ':has': 'css-has',
    };
    
    if (cssMapping[lowerQuery]) {
        const mappedId = cssMapping[lowerQuery];
        if (this.featureMap.has(mappedId)) {
            return { id: mappedId, ...this.featureMap.get(mappedId) };
        }
    }
    
    return null;
}


    private formatFeatureInfo(feature: any): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;

        // Fix: Check correct property path
        const status = feature.status?.baseline_status || feature.status?.baseline || 'unknown';

        // Better status mapping
        let icon = '❓';
        let statusText = 'Unknown';

        if (status === 'high' || status === 'widely') {
            icon = '✅';
            statusText = 'Widely Available';
        } else if (status === 'low' || status === 'newly') {
            icon = '⚠️';
            statusText = 'Newly Available';
        } else if (status === 'limited' || status === false) {
            icon = '❌';
            statusText = 'Limited Availability';
        }

        md.appendMarkdown(`### ${icon} ${feature.name || feature.id}\n\n`);
        md.appendMarkdown(`**Status:** ${statusText}\n\n`);

        // Add description if available
        if (feature.description_html) {
            md.appendMarkdown(`${feature.description_html}\n\n`);
        }

        if (feature.status?.baseline_low_date) {
            md.appendMarkdown(`**Available since:** ${feature.status.baseline_low_date}\n\n`);
        }

        if (feature.status?.support) {
            md.appendMarkdown(`**Browser Support:**\n`);
            Object.entries(feature.status.support).forEach(([browser, version]) => {
                md.appendMarkdown(`- ${browser}: ${version}+\n`);
            });
        }

        // Add MDN link if available
        if (feature.caniuse) {
            md.appendMarkdown(`\n[View on Can I Use](https://caniuse.com/${feature.caniuse})`);
        }

        return md;
    }


    public async checkFile() {
        await this.featuresPromise;

        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const text = editor.document.getText();
        const findings: string[] = [];

        this.featureMap.forEach((feature, id) => {
            if (text.includes(id) && feature.status?.baseline !== 'widely') {
                findings.push(`⚠️ ${feature.name}: ${feature.status?.baseline || 'limited'}`);
            }
        });

        if (findings.length > 0) {
            vscode.window.showInformationMessage(
                `Found ${findings.length} compatibility concerns`,
                'Show Details'
            ).then(selection => {
                if (selection) {
                    const panel = vscode.window.createOutputChannel('Baseline Report');
                    panel.appendLine('=== Baseline Compatibility Report ===\n');
                    findings.forEach(f => panel.appendLine(f));
                    panel.show();
                }
            });
        } else {
            vscode.window.showInformationMessage('✅ All features are widely available!');
        }
    }
}
