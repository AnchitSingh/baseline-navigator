import * as vscode from 'vscode';
import { BaselineProvider } from './baselineProvider';
import { GraphView } from './graphView';
import { BaselineCodeActionProvider } from './codeActions';

export function activate(context: vscode.ExtensionContext) {
    console.log('Baseline Navigator activated!');
    
    const provider = new BaselineProvider();
    const graphView = new GraphView(context.extensionUri);
    const codeActionProvider = new BaselineCodeActionProvider();
    
    // Register hover provider
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            ['css', 'javascript', 'typescript', 'html'],
            provider
        )
    );
    
    // Register code actions
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            ['css', 'javascript', 'typescript'],
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
        vscode.commands.registerCommand('baseline-navigator.checkCompatibility', () => {
            provider.checkFile();
        })
    );
}
