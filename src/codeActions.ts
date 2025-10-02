import * as vscode from 'vscode';

export class BaselineCodeActionProvider implements vscode.CodeActionProvider {
    private featuresPromise: Promise<any>;
    private featureMap: Map<string, any> = new Map();
    
    constructor() {
        this.featuresPromise = import('web-features').then(mod => {
            Object.entries(mod.features).forEach(([id, feature]) => {
                this.featureMap.set(id, feature);
            });
            return mod.features;
        });
    }
    
    public async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range
    ): Promise<vscode.CodeAction[]> {
        await this.featuresPromise;
        
        const actions: vscode.CodeAction[] = [];
        const word = document.getText(range);
        
        // Check if this feature has limited support
        const feature = this.searchFeature(word);
        if (feature && (feature.status?.baseline === 'limited' || feature.status?.baseline === false)) {
            // Suggest alternatives
            const alternative = this.findAlternative(feature.id);
            if (alternative) {
                const action = new vscode.CodeAction(
                    `💡 Use ${alternative.name} instead (widely supported)`,
                    vscode.CodeActionKind.QuickFix
                );
                action.command = {
                    command: 'baseline-navigator.showAlternative',
                    title: 'Show Alternative',
                    arguments: [alternative]
                };
                actions.push(action);
            }
        }
        
        return actions;
    }
    
    private searchFeature(query: string): any {
        // Same logic as baselineProvider
        const lowerQuery = query.toLowerCase();
        for (const [id, feature] of this.featureMap) {
            if (id.includes(lowerQuery)) {
                return { id, ...feature };
            }
        }
        return null;
    }
    
    private findAlternative(featureId: string): any {
        // Simple alternatives mapping
        const alternatives: Record<string, string> = {
            'subgrid': 'grid',
            'container-queries': 'media-queries',
        };
        
        const altId = alternatives[featureId];
        if (altId && this.featureMap.has(altId)) {
            return { id: altId, ...this.featureMap.get(altId) };
        }
        return null;
    }
}
