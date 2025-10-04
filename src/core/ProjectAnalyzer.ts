import * as vscode from 'vscode';
import * as path from 'path';
import { InvertedIndex } from './InvertedIndex';
import { Feature } from '../types';
import { ALTERNATIVES_MAPPING, UPGRADES_MAPPING, FEATURE_ID_MAPPING } from './FeatureMappings';

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
    private featurePatterns: Map<string, RegExp[]> = new Map();
    private jsApiPatterns: Map<string, RegExp[]> = new Map();
    private analysisCache: Map<string, ProjectAnalysis> = new Map(); // Cache for project analysis
    private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes
    
    constructor(private index: InvertedIndex) {
        this.initializePatterns();
    }
    
    private initializePatterns() {
        // CSS Feature patterns
        this.featurePatterns.set('grid', [
            /display:\s*grid/gi,
            /grid-template/gi,
            /grid-area/gi,
            /grid-column/gi,
            /grid-row/gi
        ]);
        
        this.featurePatterns.set('flexbox', [
            /display:\s*flex/gi,
            /flex-direction/gi,
            /flex-wrap/gi,
            /justify-content/gi,
            /align-items/gi
        ]);
        
        this.featurePatterns.set('container-queries', [
            /@container/gi,
            /container-type/gi,
            /container-name/gi
        ]);
        
        this.featurePatterns.set('subgrid', [
            /grid-template-columns:\s*subgrid/gi,
            /grid-template-rows:\s*subgrid/gi
        ]);
        
        this.featurePatterns.set('css-has', [
            /:has\([^)]+\)/gi
        ]);
        
        this.featurePatterns.set('css-nesting', [
            /&\s*\{/gi,
            /&\./gi,
            /&#/gi,
            /&\s+{/gi
        ]);
        
        this.featurePatterns.set('cascade-layers', [
            /@layer/gi
        ]);
        
        this.featurePatterns.set('aspect-ratio', [
            /aspect-ratio:/gi
        ]);
        
        this.featurePatterns.set('gap', [
            /gap:/gi,
            /column-gap:/gi,
            /row-gap:/gi
        ]);
        
        this.featurePatterns.set('custom-properties', [
            /--[\w-]+:/gi,
            /var\([^)]+\)/gi
        ]);
        
        this.featurePatterns.set('clamp', [
            /clamp\([^)]+\)/gi
        ]);
        
        this.featurePatterns.set('backdrop-filter', [
            /backdrop-filter:/gi
        ]);
        
        this.featurePatterns.set('scroll-snap', [
            /scroll-snap-type:/gi,
            /scroll-snap-align:/gi
        ]);
        
        this.featurePatterns.set('sticky', [
            /position:\s*sticky/gi
        ]);
        
        this.featurePatterns.set('transforms', [
            /transform:/gi,
            /rotate\([^)]+\)/gi,
            /scale\([^)]+\)/gi,
            /translate\([^)]+\)/gi
        ]);
        
        this.featurePatterns.set('animations', [
            /@keyframes/gi,
            /animation:/gi,
            /animation-name:/gi
        ]);
        
        this.featurePatterns.set('transitions', [
            /transition:/gi,
            /transition-property:/gi
        ]);
        
        // JavaScript API patterns
        this.jsApiPatterns.set('intersection-observer', [
            /new\s+IntersectionObserver/gi,
            /IntersectionObserver\([^)]*\)/gi
        ]);
        
        this.jsApiPatterns.set('fetch-api', [
            /fetch\([^)]*\)/gi,
            /\.fetch\([^)]*\)/gi
        ]);
        
        this.jsApiPatterns.set('web-components', [
            /customElements\.define/gi,
            /class\s+\w+\s+extends\s+HTMLElement/gi,
            /shadowRoot/gi
        ]);
        
        this.jsApiPatterns.set('promises', [
            /new\s+Promise/gi,
            /\.then\([^)]*\)/gi,
            /\.catch\([^)]*\)/gi,
            /async\s+function/gi,
            /await\s+/gi
        ]);
        
        this.jsApiPatterns.set('es-modules', [
            /import\s+.*\s+from/gi,
            /export\s+(default|const|function|class)/gi
        ]);
        
        this.jsApiPatterns.set('array-methods', [
            /\.map\([^)]*\)/gi,
            /\.filter\([^)]*\)/gi,
            /\.reduce\([^)]*\)/gi,
            /\.find\([^)]*\)/gi,
            /\.includes\([^)]*\)/gi
        ]);
        
        this.jsApiPatterns.set('optional-chaining', [
            /\?\./gi,
            /\?\?\s/gi
        ]);
        
        this.jsApiPatterns.set('destructuring', [
            /const\s*\{[^}]+\}\s*=/gi,
            /const\s*\[[^\]]+\]\s*=/gi
        ]);
    }
    
    public async analyzeProject(): Promise<ProjectAnalysis> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folder open');
        }
        
        // Create a cache key based on workspace folders and their modification times
        const workspacePaths = workspaceFolders.map(folder => folder.uri.fsPath).sort();
        const cacheKey = `analysis_${workspacePaths.join('_')}`;
        
        // Check if we have a valid cached result
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
        
        // Find all relevant files
        const files = await vscode.workspace.findFiles(
            '**/*.{css,scss,less,sass,js,jsx,ts,tsx,html,vue,svelte}',
            '**/node_modules/**',
            1000
        );
        
        analysis.totalFiles = files.length;
        
        // Analyze each file with progress
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
                    // Don't fail the entire analysis due to one file error
                }
            }
        });
        
        // Calculate compatibility score and categorize features
        await this.calculateCompatibility(analysis);
        
        // Generate suggestions
        this.generateSuggestions(analysis);
        
        // Debug logging
        console.log('Analysis complete:', {
            featuresFound: analysis.features.size,
            safeFeatures: analysis.safeFeatures.length,
            riskFeatures: analysis.riskFeatures.length,
            score: analysis.compatibilityScore
        });
        
        // Cache the result
        this.analysisCache.set(cacheKey, analysis);
        this.scheduleCacheCleanup(cacheKey);
        
        return analysis;
    }
    
    private async analyzeDocument(document: vscode.TextDocument, analysis: ProjectAnalysis) {
        const text = document.getText();
        const fileName = path.basename(document.fileName);
        const fileExt = path.extname(document.fileName);
        
        // Choose patterns based on file type
        let patterns: Map<string, RegExp[]>;
        if (['.css', '.scss', '.less', '.sass'].includes(fileExt)) {
            patterns = this.featurePatterns;
        } else if (['.js', '.jsx', '.ts', '.tsx'].includes(fileExt)) {
            patterns = this.jsApiPatterns;
        } else if (['.html', '.vue', '.svelte'].includes(fileExt)) {
            patterns = new Map([...this.featurePatterns, ...this.jsApiPatterns]);
        } else {
            return;
        }
        
        // Search for features
        for (const [patternKey, regexps] of patterns) {
            for (const regex of regexps) {
                const matches = Array.from(text.matchAll(regex));
                
                if (matches.length > 0) {
                    // CRITICAL FIX: Try multiple ID variations
                    let feature: Feature | undefined;
                    let actualFeatureId: string = patternKey;
                    
                    // Try mapped ID first
                    const mappedId = FEATURE_ID_MAPPING.get(patternKey);
                    if (mappedId) {
                        feature = this.index.getFeature(mappedId);
                        if (feature) {
                            actualFeatureId = mappedId;
                        }
                    }
                    
                    // If not found, try the pattern key directly
                    if (!feature) {
                        feature = this.index.getFeature(patternKey);
                        if (feature) {
                            actualFeatureId = patternKey;
                        }
                    }
                    
                    // Try with 'css-' prefix
                    if (!feature) {
                        feature = this.index.getFeature(`css-${patternKey}`);
                        if (feature) {
                            actualFeatureId = `css-${patternKey}`;
                        }
                    }
                    
                    // If still not found, create a synthetic feature for tracking
                    if (!feature) {
                        console.log(`Creating synthetic feature for pattern: ${patternKey}`);
                        feature = {
                            id: patternKey,
                            name: patternKey.replace(/-/g, ' ').replace(/css /g, 'CSS '),
                            status: {
                                baseline: 'widely' // Default to widely for common features we know are safe
                            }
                        };
                        
                        // Special handling for known safe features
                        if (['grid', 'flexbox', 'custom-properties', 'transforms', 'transitions', 'animations'].includes(patternKey)) {
                            feature.status!.baseline = 'widely';
                        } else if (['container-queries', 'css-has', 'subgrid'].includes(patternKey)) {
                            feature.status!.baseline = 'limited';
                        }
                    }
                    
                    // Get or create project feature entry
                    if (!analysis.features.has(actualFeatureId)) {
                        analysis.features.set(actualFeatureId, {
                            feature,
                            usageCount: 0,
                            files: [],
                            locations: []
                        });
                    }
                    
                    const projectFeature = analysis.features.get(actualFeatureId)!;
                    projectFeature.usageCount += matches.length;
                    
                    if (!projectFeature.files.includes(fileName)) {
                        projectFeature.files.push(fileName);
                    }
                    
                    // Store locations
                    matches.forEach(match => {
                        const position = document.positionAt(match.index!);
                        projectFeature.locations.push({
                            file: fileName,
                            line: position.line + 1,
                            column: position.character + 1,
                            context: match[0]
                        });
                    });
                    
                    console.log(`Found feature: ${actualFeatureId} (${matches.length} matches)`);
                }
            }
        }
    }
    
    private async calculateCompatibility(analysis: ProjectAnalysis) {
        let totalScore = 0;
        let featureCount = 0;
        
        // Clear previous categorization
        analysis.riskFeatures = [];
        analysis.safeFeatures = [];
        
        for (const [featureId, projectFeature] of analysis.features) {
            const feature = projectFeature.feature;
            const baseline = feature.status?.baseline;
            
            console.log(`Feature ${featureId}: baseline = ${baseline}`);
            
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
                // For unknown features, default to safe if they're common CSS
                if (['grid', 'flexbox', 'custom-properties'].includes(featureId)) {
                    score = 100;
                    analysis.safeFeatures.push(projectFeature);
                } else {
                    score = 50;
                }
            }
            
            // Weight by usage count
            const weight = Math.log(projectFeature.usageCount + 1);
            totalScore += score * weight;
            featureCount += weight;
        }
        
        analysis.compatibilityScore = featureCount > 0 
            ? Math.round(totalScore / featureCount) 
            : 100;
            
        // Sort by usage count
        analysis.riskFeatures.sort((a, b) => b.usageCount - a.usageCount);
        analysis.safeFeatures.sort((a, b) => b.usageCount - a.usageCount);
        
        console.log(`Compatibility calculation: score=${analysis.compatibilityScore}, safe=${analysis.safeFeatures.length}, risk=${analysis.riskFeatures.length}`);
    }
    
    private generateSuggestions(analysis: ProjectAnalysis) {
        const suggestions: string[] = [];
        
        // Overall score suggestion
        if (analysis.compatibilityScore >= 90) {
            suggestions.push('✅ Excellent! Your project has great browser compatibility.');
        } else if (analysis.compatibilityScore >= 70) {
            suggestions.push('⚠️ Good compatibility, but some features may need fallbacks.');
        } else {
            suggestions.push('❌ Several compatibility issues found. Consider adding polyfills or alternatives.');
        }
        
        // Specific risk features with alternatives
        if (analysis.riskFeatures.length > 0) {
            suggestions.push(`\n🔍 Found ${analysis.riskFeatures.length} features with limited support:`);
            
            analysis.riskFeatures.slice(0, 5).forEach(rf => {
                const featureName = rf.feature.name || rf.feature.id;
                suggestions.push(`  • ${featureName}: Used ${rf.usageCount} times in ${rf.files.length} file(s)`);
                
                // Check for alternatives in our mapping
                const alternatives = ALTERNATIVES_MAPPING[rf.feature.id] || [];
                if (alternatives.length > 0) {
                    suggestions.push(`    → Alternatives: ${alternatives.join(', ')}`);
                } else {
                    // If no specific alternative is mapped, suggest general fallback approaches
                    const generalAlternatives = this.getGeneralAlternatives(rf.feature.id);
                    if (generalAlternatives.length > 0) {
                        suggestions.push(`    → Alternatives: ${generalAlternatives.join(', ')}`);
                    }
                }
            });
        }
        
        // Add modernization recommendations if score is not perfect
        if (analysis.compatibilityScore < 100) {
            const upgradeSuggestions: string[] = [];
            const recommendedUpgrades = new Set<string>();

            // Suggest upgrades for existing features
            analysis.features.forEach((projectFeature, featureId) => {
                const upgradeTargetId = UPGRADES_MAPPING[featureId];
                if (upgradeTargetId && !analysis.features.has(upgradeTargetId) && !recommendedUpgrades.has(upgradeTargetId)) {
                    const upgradeTargetFeature = this.index.getFeature(upgradeTargetId);
                    const sourceFeatureName = projectFeature.feature.name || featureId;
                    const targetFeatureName = upgradeTargetFeature?.name || upgradeTargetId;
                    
                    upgradeSuggestions.push(`  • Consider upgrading from '${sourceFeatureName}' to '${targetFeatureName}' for modern standards.`);
                    recommendedUpgrades.add(upgradeTargetId);
                }
            });

            if (upgradeSuggestions.length > 0) {
                suggestions.push('\n💡 Modernization Opportunities:');
                suggestions.push(...upgradeSuggestions);
            }
        }
        
        // Most used safe features
        if (analysis.safeFeatures.length > 0) {
            suggestions.push(`\n✅ You're safely using ${analysis.safeFeatures.length} widely supported features.`);
        }
        
        // File coverage
        const coverage = (analysis.analyzedFiles / analysis.totalFiles) * 100;
        suggestions.push(`\n📊 Analyzed ${analysis.analyzedFiles} of ${analysis.totalFiles} files (${coverage.toFixed(1)}% coverage)`);
        
        analysis.suggestions = suggestions;
    }
    

    
    private getGeneralAlternatives(featureId: string): string[] {
        // Map feature patterns to common alternatives if not specifically mapped
        if (featureId.includes('container')) {
            return ['media queries', 'breakpoints'];
        } else if (featureId.includes('subgrid')) {
            return ['grid', 'flexbox', 'nested containers'];
        } else if (featureId.includes('has')) {
            return ['sibling selectors', 'parent selectors', 'javascript'];
        } else if (featureId.includes('nesting')) {
            return ['preprocessors', 'explicit selectors', 'component frameworks'];
        } else if (featureId.includes('backdrop')) {
            return ['pseudo-elements', 'positioned elements', 'javascript'];
        } else if (featureId.includes('scroll-snap')) {
            return ['smooth scrolling', 'javascript libraries', 'custom implementation'];
        } else {
            return [];
        }
    }
    
    private isCacheValid(analysis: ProjectAnalysis): boolean {
        const age = Date.now() - analysis.timestamp.getTime();
        return age < this.cacheTimeout;
    }
    
    private scheduleCacheCleanup(cacheKey: string): void {
        // Clean up the cache after the timeout period
        setTimeout(() => {
            this.analysisCache.delete(cacheKey);
        }, this.cacheTimeout);
    }
}