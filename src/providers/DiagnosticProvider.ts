import * as vscode from 'vscode';
import { InvertedIndex } from '../core/InvertedIndex';
import { Feature } from '../types';

export class BaselineDiagnosticProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private cssFeaturePatterns: Map<string, RegExp> = new Map(); // Initialize here

    constructor(private index: InvertedIndex) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('baseline');
        this.initializePatterns();
    }

    private initializePatterns() {
        // Now this adds to the already initialized Map
        this.cssFeaturePatterns.set('grid', /display:\s*grid/gi);
        this.cssFeaturePatterns.set('subgrid', /grid-template-(rows|columns):\s*subgrid/gi);
        this.cssFeaturePatterns.set('flexbox', /display:\s*flex/gi);
        this.cssFeaturePatterns.set('container-queries', /@container/gi);
        this.cssFeaturePatterns.set('css-has', /:has\([^)]+\)/gi);
        this.cssFeaturePatterns.set('aspect-ratio', /aspect-ratio:/gi);
        this.cssFeaturePatterns.set('gap', /gap:/gi);
        this.cssFeaturePatterns.set('custom-properties', /--[\w-]+:/gi);
        this.cssFeaturePatterns.set('calc', /calc\([^)]+\)/gi);
        this.cssFeaturePatterns.set('clamp', /clamp\([^)]+\)/gi);
        this.cssFeaturePatterns.set('min', /min\([^)]+\)/gi);
        this.cssFeaturePatterns.set('max', /max\([^)]+\)/gi);
        this.cssFeaturePatterns.set('scroll-snap', /scroll-snap-type:/gi);
        this.cssFeaturePatterns.set('sticky', /position:\s*sticky/gi);
        this.cssFeaturePatterns.set('backdrop-filter', /backdrop-filter:/gi);
    }

    public async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
        if (!this.shouldAnalyze(document)) {
            this.diagnosticCollection.clear();
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // Analyze CSS features
        for (const [featureId, pattern] of this.cssFeaturePatterns) {
            const matches = Array.from(text.matchAll(pattern));
            
            for (const match of matches) {
                const feature = this.index.getFeature(featureId);
                if (feature && this.shouldWarn(feature)) {
                    const startPos = document.positionAt(match.index!);
                    const endPos = document.positionAt(match.index! + match[0].length);
                    const range = new vscode.Range(startPos, endPos);
                    
                    const diagnostic = this.createDiagnostic(range, feature);
                    diagnostics.push(diagnostic);
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
        let severity = vscode.DiagnosticSeverity.Information;
        let message = '';

        if (baseline === 'limited' || baseline === false) {
            severity = vscode.DiagnosticSeverity.Warning;
            message = `⚠️ "${feature.name}" has limited browser support`;
        } else if (baseline === 'newly') {
            severity = vscode.DiagnosticSeverity.Information;
            message = `ℹ️ "${feature.name}" is newly available (may not work in older browsers)`;
        }

        const diagnostic = new vscode.Diagnostic(range, message, severity);
        diagnostic.code = feature.id;
        diagnostic.source = 'Baseline Navigator';

        // Add browser support details
        if (feature.status?.support) {
            const supportInfo = Object.entries(feature.status.support)
                .map(([browser, version]) => `${browser}: ${version}+`)
                .join(', ');
            diagnostic.relatedInformation = [
                new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(vscode.Uri.parse('https://web.dev'), range),
                    `Browser support: ${supportInfo}`
                )
            ];
        }

        return diagnostic;
    }

    public dispose() {
        this.diagnosticCollection.dispose();
    }
}