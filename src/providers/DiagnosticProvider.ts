import * as vscode from 'vscode';
import { InvertedIndex } from '../core/InvertedIndex';
import { FeaturePatternRegistry } from '../core/FeaturePatternRegistry';
import { ConfigurationManager } from '../core/ConfigurationManager';
import { Feature } from '../types';

export class BaselineDiagnosticProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private patternRegistry: FeaturePatternRegistry;

    constructor(
        private index: InvertedIndex,
        private configManager: ConfigurationManager
    ) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('baseline');
        this.patternRegistry = new FeaturePatternRegistry();
    }

    public async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
        const config = this.configManager.getConfiguration();

        if (!config.enabled) {
            this.diagnosticCollection.clear();
            return;
        }

        if (!this.shouldAnalyze(document)) {
            this.diagnosticCollection.clear();
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // Use pattern registry to detect features
        const detectedFeatures = this.patternRegistry.detectFeatures(text, document.languageId);

        for (const [patternId, matchCount] of detectedFeatures) {
            // Get feature from index
            let feature = this.index.getFeature(patternId);

            // Try aliases if not found
            if (!feature) {
                const resolvedId = this.patternRegistry.resolveFeatureId(patternId);
                if (resolvedId) {
                    feature = this.index.getFeature(resolvedId);
                }
            }

            if (feature && this.shouldWarn(feature)) {
                // Find actual match positions
                const pattern = this.patternRegistry.getPattern(patternId);
                if (pattern) {
                    pattern.patterns.forEach(regex => {
                        const matches = Array.from(text.matchAll(regex));
                        matches.forEach(match => {
                            const startPos = document.positionAt(match.index!);
                            const endPos = document.positionAt(match.index! + match[0].length);
                            const range = new vscode.Range(startPos, endPos);

                            const diagnostic = this.createDiagnostic(range, feature!);
                            diagnostics.push(diagnostic);
                        });
                    });
                }
            }
        }

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private shouldAnalyze(document: vscode.TextDocument): boolean {
        const supportedLanguages = ['css', 'scss', 'less', 'sass', 'stylus', 'javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
        return supportedLanguages.includes(document.languageId);
    }

    private shouldWarn(feature: Feature): boolean {
        const baseline = feature.status?.baseline;
        return baseline === 'limited' || baseline === false || baseline === 'newly';
    }

    private createDiagnostic(range: vscode.Range, feature: Feature): vscode.Diagnostic {
        const baseline = feature.status?.baseline;
        let message = '';
        let baselineString: string;

        // FIX: Convert baseline to string for comparison
        if (baseline === false) {
            baselineString = 'limited';
            message = `⚠️ "${feature.name}" has limited browser support`;
        } else if (baseline === 'limited') {
            baselineString = 'limited';
            message = `⚠️ "${feature.name}" has limited browser support`;
        } else if (baseline === 'newly') {
            baselineString = 'newly';
            message = `ℹ️ "${feature.name}" is newly available (may not work in older browsers)`;
        } else {
            baselineString = 'unknown';
            message = `❓ "${feature.name}" has unknown support status`;
        }

        const severity = this.configManager.getDiagnosticSeverity(baselineString);
        const diagnostic = new vscode.Diagnostic(range, message, severity);
        diagnostic.code = feature.id;
        diagnostic.source = 'Baseline Navigator';

        // Add browser support details
        if (feature.status?.support) {
            const config = this.configManager.getConfiguration();
            const targetBrowsers = config.targetBrowsers;

            const supportInfo = Object.entries(feature.status.support)
                .filter(([browser]) => targetBrowsers.includes(browser))
                .map(([browser, version]) => `${browser}: ${version}+`)
                .join(', ');

            diagnostic.relatedInformation = [
                new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(vscode.Uri.parse('https://web.dev'), range),
                    `Browser support (your targets): ${supportInfo || 'Not available for your target browsers'}`
                )
            ];
        }

        return diagnostic;
    }

    public dispose() {
        this.diagnosticCollection.dispose();
    }
}