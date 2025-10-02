import * as vscode from 'vscode';
import { InvertedIndex } from '../core/InvertedIndex';
import { RecommendationEngine } from '../core/RecommendationEngine';

export class BaselineCodeActionProvider implements vscode.CodeActionProvider {
    private recommendationEngine: RecommendationEngine;

    constructor(private index: InvertedIndex) {
        this.recommendationEngine = new RecommendationEngine(index);
    }

    async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.CodeAction[]> {
        const actions: vscode.CodeAction[] = [];
        const word = document.getText(range);
        
        // Search for the feature
        const results = await this.index.search(word);
        if (results.length === 0) return actions;

        const feature = results[0];
        
        // Get recommendations
        const recommendations = await this.recommendationEngine.getRecommendations({
            currentFeature: feature.id,
            documentLanguage: document.languageId
        });

        // Create code actions for each recommendation
        recommendations.slice(0, 3).forEach(rec => {
            if (rec.confidence > 0.7) {
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
            }
        });

        // Add refactor action for alternatives
        if (recommendations.some(r => r.alternatives)) {
            const refactorAction = new vscode.CodeAction(
                '🔄 Show all alternatives',
                vscode.CodeActionKind.Refactor
            );
            
            refactorAction.command = {
                command: 'baseline-navigator.showAlternatives',
                title: 'Show Alternatives',
                arguments: [feature, recommendations]
            };
            
            actions.push(refactorAction);
        }

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