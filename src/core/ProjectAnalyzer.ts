import * as vscode from 'vscode';
import * as path from 'path';
import { InvertedIndex } from './InvertedIndex';
import { FeaturePatternRegistry } from './FeaturePatternRegistry';
import { Feature } from '../types';

export interface ProjectFeature {
    feature: Feature;
    usageCount: number;
    files: string[];
    locations: Array<{
        file: string;
        line: number;
        column: number;
        context: string;
    }>;
}

export interface ProjectAnalysis {
    features: Map<string, ProjectFeature>;
    totalFiles: number;
    analyzedFiles: number;
    compatibilityScore: number;
    riskFeatures: ProjectFeature[];
    safeFeatures: ProjectFeature[];
    suggestions: string[];
    timestamp: Date;
}

export class ProjectAnalyzer {
    private patternRegistry: FeaturePatternRegistry;
    private analysisCache: Map<string, ProjectAnalysis> = new Map();
    private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes
    
    constructor(private index: InvertedIndex) {
        this.patternRegistry = new FeaturePatternRegistry();
    }
    
    public async analyzeProject(): Promise<ProjectAnalysis> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folder open');
        }
        
        const workspacePaths = workspaceFolders.map(folder => folder.uri.fsPath).sort();
        const cacheKey = `analysis_${workspacePaths.join('_')}`;
        
        const cachedAnalysis = this.analysisCache.get(cacheKey);
        if (cachedAnalysis && this.isCacheValid(cachedAnalysis)) {
            console.log('Returning cached analysis');
            return cachedAnalysis;
        }
        
        const analysis: ProjectAnalysis = {
            features: new Map(),
            totalFiles: 0,
            analyzedFiles: 0,
            compatibilityScore: 100,
            riskFeatures: [],
            safeFeatures: [],
            suggestions: [],
            timestamp: new Date()
        };
        
        const files = await vscode.workspace.findFiles(
            '**/*.{css,scss,less,sass,js,jsx,ts,tsx,html,vue,svelte}',
            '**/node_modules/**',
            1000
        );
        
        analysis.totalFiles = files.length;
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Analyzing project features...',
            cancellable: false
        }, async (progress) => {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                progress.report({ 
                    increment: (100 / files.length),
                    message: `Analyzing ${path.basename(file.fsPath)}...`
                });
                
                try {
                    const document = await vscode.workspace.openTextDocument(file);
                    await this.analyzeDocument(document, analysis);
                    analysis.analyzedFiles++;
                } catch (error) {
                    console.error(`Error analyzing ${file.fsPath}:`, error);
                }
            }
        });
        
        await this.calculateCompatibility(analysis);
        this.generateSuggestions(analysis);
        
        console.log('Analysis complete:', {
            featuresFound: analysis.features.size,
            safeFeatures: analysis.safeFeatures.length,
            riskFeatures: analysis.riskFeatures.length,
            score: analysis.compatibilityScore
        });
        
        this.analysisCache.set(cacheKey, analysis);
        this.scheduleCacheCleanup(cacheKey);
        
        return analysis;
    }
    
    private async analyzeDocument(document: vscode.TextDocument, analysis: ProjectAnalysis): Promise<void> {
        const text = document.getText();
        const fileName = path.basename(document.fileName);
        
        // Use pattern registry to detect features
        const detectedFeatures = this.patternRegistry.detectFeatures(text, document.languageId);
        
        // Process each detected feature
        for (const [patternId, matchCount] of detectedFeatures) {
            // Resolve to actual feature from web-features
            let feature = this.index.getFeature(patternId);
            
            // If not found, try to find by pattern aliases
            if (!feature) {
                const pattern = this.patternRegistry.getPattern(patternId);
                if (pattern) {
                    // Try all aliases
                    for (const alias of pattern.aliases) {
                        feature = this.index.getFeature(alias);
                        if (feature) break;
                    }
                }
            }
            
            // If still not found, create synthetic feature
            if (!feature) {
                const pattern = this.patternRegistry.getPattern(patternId);
                feature = {
                    id: patternId,
                    name: pattern?.description || patternId.replace(/-/g, ' '),
                    description: pattern?.description,
                    status: {
                        baseline: pattern?.riskLevel === 'safe' ? 'widely' : 
                                 pattern?.riskLevel === 'experimental' ? 'limited' : 'newly'
                    }
                };
            }
            
            // Get or create project feature entry
            const actualFeatureId = feature.id;
            if (!analysis.features.has(actualFeatureId)) {
                analysis.features.set(actualFeatureId, {
                    feature,
                    usageCount: 0,
                    files: [],
                    locations: []
                });
            }
            
            const projectFeature = analysis.features.get(actualFeatureId)!;
            projectFeature.usageCount += matchCount;
            
            if (!projectFeature.files.includes(fileName)) {
                projectFeature.files.push(fileName);
            }
            
            // Find actual locations
            const pattern = this.patternRegistry.getPattern(patternId);
            if (pattern) {
                pattern.patterns.forEach(regex => {
                    const matches = Array.from(text.matchAll(regex));
                    matches.forEach(match => {
                        const position = document.positionAt(match.index!);
                        projectFeature.locations.push({
                            file: fileName,
                            line: position.line + 1,
                            column: position.character + 1,
                            context: match[0]
                        });
                    });
                });
            }
            
            console.log(`Found feature: ${actualFeatureId} (${matchCount} matches in ${fileName})`);
        }
    }
    
    private async calculateCompatibility(analysis: ProjectAnalysis): Promise<void> {
        let totalScore = 0;
        let featureCount = 0;
        
        analysis.riskFeatures = [];
        analysis.safeFeatures = [];
        
        for (const [featureId, projectFeature] of analysis.features) {
            const feature = projectFeature.feature;
            const baseline = feature.status?.baseline;
            
            let score = 0;
            if (baseline === 'widely') {
                score = 100;
                analysis.safeFeatures.push(projectFeature);
            } else if (baseline === 'newly') {
                score = 70;
                analysis.riskFeatures.push(projectFeature);
            } else if (baseline === 'limited' || !baseline) {
                score = 30;
                analysis.riskFeatures.push(projectFeature);
            } else {
                score = 50;
            }
            
            const weight = Math.log(projectFeature.usageCount + 1);
            totalScore += score * weight;
            featureCount += weight;
        }
        
        analysis.compatibilityScore = featureCount > 0 
            ? Math.round(totalScore / featureCount) 
            : 100;
            
        analysis.riskFeatures.sort((a, b) => b.usageCount - a.usageCount);
        analysis.safeFeatures.sort((a, b) => b.usageCount - a.usageCount);
    }
    
    private generateSuggestions(analysis: ProjectAnalysis): void {
        const suggestions: string[] = [];
        
        if (analysis.compatibilityScore >= 90) {
            suggestions.push('✅ Excellent! Your project has great browser compatibility.');
        } else if (analysis.compatibilityScore >= 70) {
            suggestions.push('⚠️ Good compatibility, but some features may need fallbacks.');
        } else {
            suggestions.push('❌ Several compatibility issues found. Consider adding polyfills or alternatives.');
        }
        
        if (analysis.riskFeatures.length > 0) {
            suggestions.push(`\n🔍 Found ${analysis.riskFeatures.length} features with limited support:`);
            
            analysis.riskFeatures.slice(0, 5).forEach(rf => {
                const featureName = rf.feature.name || rf.feature.id;
                suggestions.push(`  • ${featureName}: Used ${rf.usageCount} times in ${rf.files.length} file(s)`);
                
                const alternatives = this.patternRegistry.getAlternatives(rf.feature.id);
                if (alternatives.length > 0) {
                    suggestions.push(`    → Alternatives: ${alternatives.join(', ')}`);
                }
            });
        }
        
        if (analysis.safeFeatures.length > 0) {
            suggestions.push(`\n✅ You're safely using ${analysis.safeFeatures.length} widely supported features.`);
        }
        
        const coverage = (analysis.analyzedFiles / analysis.totalFiles) * 100;
        suggestions.push(`\n📊 Analyzed ${analysis.analyzedFiles} of ${analysis.totalFiles} files (${coverage.toFixed(1)}% coverage)`);
        
        analysis.suggestions = suggestions;
    }
    
    private isCacheValid(analysis: ProjectAnalysis): boolean {
        const age = Date.now() - analysis.timestamp.getTime();
        return age < this.cacheTimeout;
    }
    
    private scheduleCacheCleanup(cacheKey: string): void {
        setTimeout(() => {
            this.analysisCache.delete(cacheKey);
        }, this.cacheTimeout);
    }
}