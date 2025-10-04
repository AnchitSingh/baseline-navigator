import * as vscode from 'vscode';
import { InvertedIndex } from '../core/InvertedIndex';
import { RecommendationEngine } from '../core/RecommendationEngine';
import { ConfigurationManager } from '../core/ConfigurationManager';

export class BaselineCodeActionProvider implements vscode.CodeActionProvider {
    private recommendationEngine: RecommendationEngine;

    constructor(
        private index: InvertedIndex,
        private configManager: ConfigurationManager
    ) {
        this.recommendationEngine = new RecommendationEngine(index);
    }

    async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.CodeAction[]> {
        const config = this.configManager.getConfiguration();
        
        if (!config.enabled || !config.enableCodeActions || !config.showRecommendations) {
            return [];
        }
        
        const actions: vscode.CodeAction[] = [];
        const word = document.getText(range);
        
        // Search for the feature
        const results = await this.index.search(word);
        if (results.length === 0) return actions;

        const feature = results[0];
        
        // Get recommendations
        const recommendations = await this.recommendationEngine.getRecommendations({
            currentFeature: feature.id,
            documentLanguage: document.languageId,
            targetBrowsers: config.targetBrowsers
        });

        // Create code actions for top recommendations
        recommendations
            .slice(0, config.maxRecommendations)
            .filter(rec => rec.confidence > 0.7)
            .forEach(rec => {
                const action = new vscode.CodeAction(
                    `💡 ${rec.reason}`,
                    vscode.CodeActionKind.QuickFix
                );
                
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, range, rec.feature.id);
                
                action.command = {
                    command: 'baseline-navigator.showFeatureDetails',
                    title: 'Show Details',
                    arguments: [rec.feature]
                };
                
                actions.push(action);
            });

        // Add documentation action
        const docAction = new vscode.CodeAction(
            '📚 View documentation',
            vscode.CodeActionKind.Empty
        );
        
        docAction.command = {
            command: 'baseline-navigator.openDocumentation',
            title: 'Open Documentation',
            arguments: [feature]
        };
        
        actions.push(docAction);

        return actions;
    }
}