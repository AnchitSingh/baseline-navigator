/**
 * Centralized registry for all feature detection patterns
 * Single source of truth for CSS, JavaScript, and HTML feature detection
 */

export interface FeaturePatternDefinition {
    // Pattern identification
    id: string;                           // Primary ID (matches web-features when possible)
    aliases: string[];                    // Alternative IDs this pattern might match
    
    // Detection patterns
    patterns: RegExp[];                   // Regex patterns to detect this feature
    
    // Metadata
    category: 'css' | 'js' | 'html' | 'api';
    subcategory?: string;                 // e.g., 'layout', 'typography', 'async'
    riskLevel: 'safe' | 'moderate' | 'experimental';
    
    // Relationships (for recommendations)
    alternatives?: string[];              // Better-supported alternatives
    upgradeTo?: string;                   // Newer version to upgrade to
    complementary?: string[];             // Features often used together
    supersedes?: string[];                // What this replaces
    
    // Context
    description?: string;
    commonUseCases?: string[];
}

export class FeaturePatternRegistry {
    private patterns: Map<string, FeaturePatternDefinition> = new Map();
    private aliasMap: Map<string, string> = new Map(); // alias -> primary ID
    private categoryIndex: Map<string, Set<string>> = new Map();
    
    constructor() {
        this.initializePatterns();
        this.buildIndices();
    }
    
    private initializePatterns(): void {
        const definitions: FeaturePatternDefinition[] = [
            // ==========================================
            // CSS LAYOUT
            // ==========================================
            {
                id: 'grid',
                aliases: ['css-grid', 'display-grid'],
                patterns: [
                    /display:\s*grid/gi,
                    /grid-template-(?:columns|rows|areas)/gi,
                    /grid-(?:column|row)(?:-(?:start|end|gap))?/gi,
                    /grid-auto-(?:flow|rows|columns)/gi,
                    /grid-area/gi
                ],
                category: 'css',
                subcategory: 'layout',
                riskLevel: 'safe',
                complementary: ['gap', 'subgrid', 'aspect-ratio'],
                supersedes: ['float', 'table-layout'],
                description: 'CSS Grid Layout - two-dimensional layout system',
                commonUseCases: ['Page layouts', 'Component grids', 'Responsive designs']
            },
            
            {
                id: 'subgrid',
                aliases: ['css-subgrid'],
                patterns: [
                    /grid-template-columns:\s*subgrid/gi,
                    /grid-template-rows:\s*subgrid/gi
                ],
                category: 'css',
                subcategory: 'layout',
                riskLevel: 'moderate',
                alternatives: ['grid', 'flexbox'],
                complementary: ['grid', 'gap'],
                description: 'CSS Subgrid - inherit grid tracks from parent',
                commonUseCases: ['Nested grid alignment', 'Complex layouts']
            },
            
            {
                id: 'flexbox',
                aliases: ['css-flexbox', 'flex'],
                patterns: [
                    /display:\s*flex/gi,
                    /flex-(?:direction|wrap|flow|grow|shrink|basis)/gi,
                    /(?:justify|align)-(?:content|items|self)/gi,
                    /order:/gi
                ],
                category: 'css',
                subcategory: 'layout',
                riskLevel: 'safe',
                upgradeTo: 'grid',
                complementary: ['gap', 'align-items'],
                supersedes: ['float', 'inline-block'],
                description: 'CSS Flexbox - one-dimensional layout system',
                commonUseCases: ['Navigation bars', 'Card layouts', 'Centering']
            },
            
            {
                id: 'gap',
                aliases: ['css-gap', 'grid-gap'],
                patterns: [
                    /(?:^|[^-])gap:/gi,
                    /(?:column|row)-gap:/gi,
                    /grid-gap:/gi // Old syntax
                ],
                category: 'css',
                subcategory: 'layout',
                riskLevel: 'safe',
                complementary: ['grid', 'flexbox'],
                description: 'Gap property for grid and flexbox',
                commonUseCases: ['Spacing grid items', 'Flexbox spacing']
            },
            
            // ==========================================
            // CSS RESPONSIVE & CONTAINER
            // ==========================================
            {
                id: 'container-queries',
                aliases: ['css-container-queries', 'container'],
                patterns: [
                    /@container(?:\s+[\w-]+)?(?:\s*KATEX_INLINE_OPEN[^)]+KATEX_INLINE_CLOSE)?/gi,
                    /container-(?:type|name):/gi
                ],
                category: 'css',
                subcategory: 'responsive',
                riskLevel: 'experimental',
                alternatives: ['media-queries', 'clamp', 'viewport-units'],
                complementary: ['clamp', 'aspect-ratio'],
                description: 'Container Queries - responsive design based on container size',
                commonUseCases: ['Component-level responsive design', 'Modular components']
            },
            
            {
                id: 'aspect-ratio',
                aliases: ['css-aspect-ratio'],
                patterns: [
                    /aspect-ratio:/gi
                ],
                category: 'css',
                subcategory: 'sizing',
                riskLevel: 'safe',
                alternatives: ['padding-hack'],
                complementary: ['grid', 'object-fit'],
                description: 'CSS aspect-ratio property',
                commonUseCases: ['Video containers', 'Image placeholders', 'Card layouts']
            },
            
            // ==========================================
            // CSS SELECTORS
            // ==========================================
            {
                id: 'has',
                aliases: ['css-has', ':has'],
                patterns: [
                    /:has\s*KATEX_INLINE_OPEN[^)]+KATEX_INLINE_CLOSE/gi
                ],
                category: 'css',
                subcategory: 'selectors',
                riskLevel: 'moderate',
                alternatives: ['css-not', 'css-is', 'javascript'],
                description: ':has() selector - parent selector',
                commonUseCases: ['Parent state based on children', 'Conditional styling']
            },
            
            {
                id: 'css-nesting',
                aliases: ['css-nesting-1', 'native-css-nesting'],
                patterns: [
                    /&\s*\{/gi,
                    /&\s*[\.:]/gi,
                    /&\s+[\w]/gi
                ],
                category: 'css',
                subcategory: 'syntax',
                riskLevel: 'moderate',
                alternatives: ['sass', 'postcss', 'separate-selectors'],
                description: 'Native CSS Nesting',
                commonUseCases: ['Organized stylesheets', 'Component styling']
            },
            
            {
                id: 'css-is',
                aliases: [':is', 'css-matches'],
                patterns: [
                    /:is\s*KATEX_INLINE_OPEN[^)]+KATEX_INLINE_CLOSE/gi,
                    /:matches\s*KATEX_INLINE_OPEN[^)]+KATEX_INLINE_CLOSE/gi // Old syntax
                ],
                category: 'css',
                subcategory: 'selectors',
                riskLevel: 'safe',
                complementary: ['css-where', 'css-not'],
                description: ':is() selector - matches any selector in list',
                commonUseCases: ['Simplified selectors', 'Reduced specificity']
            },
            
            {
                id: 'css-where',
                aliases: [':where'],
                patterns: [
                    /:where\s*KATEX_INLINE_OPEN[^)]+KATEX_INLINE_CLOSE/gi
                ],
                category: 'css',
                subcategory: 'selectors',
                riskLevel: 'safe',
                complementary: ['css-is', 'css-not'],
                description: ':where() selector - zero specificity',
                commonUseCases: ['Reset styles', 'Low-specificity rules']
            },
            
            // ==========================================
            // CSS CUSTOM PROPERTIES & FUNCTIONS
            // ==========================================
            {
                id: 'custom-properties',
                aliases: ['css-variables', 'css-custom-properties'],
                patterns: [
                    /--[\w-]+\s*:/gi,
                    /var\s*KATEX_INLINE_OPEN\s*--[\w-]+/gi
                ],
                category: 'css',
                subcategory: 'values',
                riskLevel: 'safe',
                complementary: ['calc', 'clamp'],
                description: 'CSS Custom Properties (Variables)',
                commonUseCases: ['Theming', 'Dynamic values', 'Design systems']
            },
            
            {
                id: 'calc',
                aliases: ['css-calc'],
                patterns: [
                    /calc\s*KATEX_INLINE_OPEN[^)]+KATEX_INLINE_CLOSE/gi
                ],
                category: 'css',
                subcategory: 'values',
                riskLevel: 'safe',
                complementary: ['custom-properties', 'clamp'],
                description: 'CSS calc() function',
                commonUseCases: ['Dynamic sizing', 'Responsive layouts']
            },
            
            {
                id: 'clamp',
                aliases: ['css-clamp'],
                patterns: [
                    /clamp\s*KATEX_INLINE_OPEN[^)]+KATEX_INLINE_CLOSE/gi
                ],
                category: 'css',
                subcategory: 'values',
                riskLevel: 'safe',
                complementary: ['calc', 'custom-properties', 'min', 'max'],
                description: 'CSS clamp() function - responsive sizing',
                commonUseCases: ['Fluid typography', 'Responsive spacing']
            },
            
            {
                id: 'min',
                aliases: ['css-min'],
                patterns: [
                    /min\s*KATEX_INLINE_OPEN[^)]+KATEX_INLINE_CLOSE/gi
                ],
                category: 'css',
                subcategory: 'values',
                riskLevel: 'safe',
                complementary: ['max', 'clamp', 'calc'],
                description: 'CSS min() function',
                commonUseCases: ['Constrained sizing', 'Responsive values']
            },
            
            {
                id: 'max',
                aliases: ['css-max'],
                patterns: [
                    /max\s*KATEX_INLINE_OPEN[^)]+KATEX_INLINE_CLOSE/gi
                ],
                category: 'css',
                subcategory: 'values',
                riskLevel: 'safe',
                complementary: ['min', 'clamp', 'calc'],
                description: 'CSS max() function',
                commonUseCases: ['Constrained sizing', 'Responsive values']
            },
            
            // ==========================================
            // CSS VISUAL EFFECTS
            // ==========================================
            {
                id: 'backdrop-filter',
                aliases: ['css-backdrop-filter'],
                patterns: [
                    /backdrop-filter:/gi
                ],
                category: 'css',
                subcategory: 'effects',
                riskLevel: 'moderate',
                alternatives: ['filter', 'background-blur-polyfill'],
                complementary: ['filter', 'opacity'],
                description: 'Backdrop filter - blur/effects on background',
                commonUseCases: ['Glassmorphism', 'Modal overlays', 'Frosted glass']
            },
            
            {
                id: 'filter',
                aliases: ['css-filter', 'css-filters'],
                patterns: [
                    /filter:\s*(?!none)[^;]+/gi,
                    /(?:blur|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia)\s*KATEX_INLINE_OPEN/gi
                ],
                category: 'css',
                subcategory: 'effects',
                riskLevel: 'safe',
                complementary: ['backdrop-filter', 'mix-blend-mode'],
                description: 'CSS Filters',
                commonUseCases: ['Image effects', 'Visual enhancements']
            },
            
            // ==========================================
            // CSS ANIMATIONS & TRANSITIONS
            // ==========================================
            {
                id: 'css-animations',
                aliases: ['animations', 'keyframes'],
                patterns: [
                    /@keyframes/gi,
                    /animation(?:-name|-duration|-timing-function|-delay|-iteration-count|-direction|-fill-mode|-play-state)?:/gi
                ],
                category: 'css',
                subcategory: 'animation',
                riskLevel: 'safe',
                complementary: ['css-transitions', 'transforms'],
                description: 'CSS Animations with @keyframes',
                commonUseCases: ['Complex animations', 'Loading states', 'Attention grabbers']
            },
            
            {
                id: 'css-transitions',
                aliases: ['transitions'],
                patterns: [
                    /transition(?:-property|-duration|-timing-function|-delay)?:/gi
                ],
                category: 'css',
                subcategory: 'animation',
                riskLevel: 'safe',
                complementary: ['css-animations', 'transforms'],
                description: 'CSS Transitions',
                commonUseCases: ['Hover effects', 'State changes', 'Smooth interactions']
            },
            
            {
                id: 'transforms',
                aliases: ['css-transforms', 'transform'],
                patterns: [
                    /transform:/gi,
                    /(?:translate|rotate|scale|skew|matrix)(?:3d|X|Y|Z)?\s*KATEX_INLINE_OPEN/gi
                ],
                category: 'css',
                subcategory: 'animation',
                riskLevel: 'safe',
                complementary: ['css-transitions', 'css-animations'],
                description: 'CSS Transforms',
                commonUseCases: ['Positioning', 'Animations', 'Visual effects']
            },
            
            // ==========================================
            // CSS SCROLL & INTERACTION
            // ==========================================
            {
                id: 'scroll-snap',
                aliases: ['css-scroll-snap'],
                patterns: [
                    /scroll-snap-(?:type|align|stop):/gi
                ],
                category: 'css',
                subcategory: 'scroll',
                riskLevel: 'safe',
                alternatives: ['smooth-scroll-library', 'javascript'],
                complementary: ['overflow', 'scroll-behavior'],
                description: 'CSS Scroll Snap',
                commonUseCases: ['Carousels', 'Full-page sections', 'Image galleries']
            },
            
            {
                id: 'position-sticky',
                aliases: ['sticky', 'css-sticky'],
                patterns: [
                    /position:\s*sticky/gi
                ],
                category: 'css',
                subcategory: 'positioning',
                riskLevel: 'safe',
                alternatives: ['position-fixed', 'javascript'],
                description: 'Sticky positioning',
                commonUseCases: ['Sticky headers', 'Sidebar navigation', 'Table headers']
            },
            
            {
                id: 'overscroll-behavior',
                aliases: ['css-overscroll-behavior'],
                patterns: [
                    /overscroll-behavior(?:-x|-y)?:/gi
                ],
                category: 'css',
                subcategory: 'scroll',
                riskLevel: 'safe',
                description: 'Overscroll behavior control',
                commonUseCases: ['Modal scroll locking', 'Prevent bounce', 'Scroll boundaries']
            },
            
            // ==========================================
            // CSS CASCADE & LAYERS
            // ==========================================
            {
                id: 'cascade-layers',
                aliases: ['css-cascade-layers', '@layer'],
                patterns: [
                    /@layer(?:\s+[\w-]+(?:\s*,\s*[\w-]+)*)?/gi
                ],
                category: 'css',
                subcategory: 'cascade',
                riskLevel: 'moderate',
                alternatives: ['specificity', 'important'],
                description: 'CSS Cascade Layers',
                commonUseCases: ['Managing specificity', 'Design systems', 'CSS architecture']
            },
            
            // ==========================================
            // CSS COLOR & THEMING
            // ==========================================
            {
                id: 'color-mix',
                aliases: ['css-color-mix'],
                patterns: [
                    /color-mix\s*KATEX_INLINE_OPEN[^)]+KATEX_INLINE_CLOSE/gi
                ],
                category: 'css',
                subcategory: 'color',
                riskLevel: 'experimental',
                alternatives: ['custom-properties', 'preprocessor'],
                complementary: ['custom-properties'],
                description: 'CSS color-mix() function',
                commonUseCases: ['Dynamic colors', 'Theming', 'Color variations']
            },
            
            // ==========================================
            // JAVASCRIPT APIS
            // ==========================================
            {
                id: 'intersection-observer',
                aliases: ['intersectionobserver', 'intersection-observer-api'],
                patterns: [
                    /new\s+IntersectionObserver/gi,
                    /IntersectionObserver\s*KATEX_INLINE_OPEN/gi
                ],
                category: 'js',
                subcategory: 'api',
                riskLevel: 'safe',
                alternatives: ['scroll-events', 'polyfill'],
                description: 'Intersection Observer API',
                commonUseCases: ['Lazy loading', 'Infinite scroll', 'Visibility tracking']
            },
            
            {
                id: 'resize-observer',
                aliases: ['resizeobserver'],
                patterns: [
                    /new\s+ResizeObserver/gi,
                    /ResizeObserver\s*KATEX_INLINE_OPEN/gi
                ],
                category: 'js',
                subcategory: 'api',
                riskLevel: 'safe',
                alternatives: ['resize-events', 'polyfill'],
                description: 'Resize Observer API',
                commonUseCases: ['Responsive components', 'Element size tracking']
            },
            
            {
                id: 'mutation-observer',
                aliases: ['mutationobserver'],
                patterns: [
                    /new\s+MutationObserver/gi,
                    /MutationObserver\s*KATEX_INLINE_OPEN/gi
                ],
                category: 'js',
                subcategory: 'api',
                riskLevel: 'safe',
                description: 'Mutation Observer API',
                commonUseCases: ['DOM change detection', 'Dynamic content']
            },
            
            {
                id: 'fetch',
                aliases: ['fetch-api'],
                patterns: [
                    /\bfetch\s*KATEX_INLINE_OPEN/gi,
                    /window\.fetch/gi
                ],
                category: 'js',
                subcategory: 'api',
                riskLevel: 'safe',
                alternatives: ['xhr', 'axios'],
                complementary: ['promises', 'async-await'],
                supersedes: ['xmlhttprequest'],
                description: 'Fetch API',
                commonUseCases: ['HTTP requests', 'API calls', 'Data fetching']
            },
            
            {
                id: 'custom-elements',
                aliases: ['web-components', 'customelements'],
                patterns: [
                    /customElements\.define/gi,
                    /class\s+\w+\s+extends\s+HTMLElement/gi,
                    /window\.customElements/gi
                ],
                category: 'js',
                subcategory: 'components',
                riskLevel: 'safe',
                complementary: ['shadow-dom', 'html-templates'],
                description: 'Custom Elements (Web Components)',
                commonUseCases: ['Reusable components', 'Design systems']
            },
            
            {
                id: 'shadow-dom',
                aliases: ['shadowdom', 'shadow-root'],
                patterns: [
                    /\.attachShadow/gi,
                    /\.shadowRoot/gi
                ],
                category: 'js',
                subcategory: 'components',
                riskLevel: 'safe',
                complementary: ['custom-elements', 'html-templates'],
                description: 'Shadow DOM',
                commonUseCases: ['Encapsulated styles', 'Web components']
            },
            
            // ==========================================
            // JAVASCRIPT LANGUAGE FEATURES
            // ==========================================
            {
                id: 'promises',
                aliases: ['promise'],
                patterns: [
                    /new\s+Promise/gi,
                    /\.then\s*KATEX_INLINE_OPEN/gi,
                    /\.catch\s*KATEX_INLINE_OPEN/gi,
                    /Promise\.(?:all|race|any|allSettled)/gi
                ],
                category: 'js',
                subcategory: 'async',
                riskLevel: 'safe',
                upgradeTo: 'async-await',
                complementary: ['fetch', 'async-await'],
                description: 'JavaScript Promises',
                commonUseCases: ['Async operations', 'Error handling']
            },
            
            {
                id: 'async-await',
                aliases: ['async-functions'],
                patterns: [
                    /async\s+function/gi,
                    /async\s*KATEX_INLINE_OPEN/gi,
                    /\basync\s+\w+\s*KATEX_INLINE_OPEN/gi,
                    /\bawait\s+/gi
                ],
                category: 'js',
                subcategory: 'async',
                riskLevel: 'safe',
                complementary: ['promises', 'fetch'],
                supersedes: ['promises'],
                description: 'Async/Await',
                commonUseCases: ['Cleaner async code', 'Sequential async operations']
            },
            
            {
                id: 'optional-chaining',
                aliases: ['optional-chaining-operator'],
                patterns: [
                    /\?\./gi
                ],
                category: 'js',
                subcategory: 'syntax',
                riskLevel: 'safe',
                complementary: ['nullish-coalescing'],
                description: 'Optional Chaining (?.)',
                commonUseCases: ['Safe property access', 'Null checking']
            },
            
            {
                id: 'nullish-coalescing',
                aliases: ['nullish-coalescing-operator'],
                patterns: [
                    /\?\?(?!\?)/g // ?? but not ???
                ],
                category: 'js',
                subcategory: 'syntax',
                riskLevel: 'safe',
                complementary: ['optional-chaining'],
                description: 'Nullish Coalescing (??)',
                commonUseCases: ['Default values', 'Null handling']
            },
            
            {
                id: 'destructuring',
                aliases: ['destructuring-assignment'],
                patterns: [
                    /(?:const|let|var)\s*\{[^}]+\}\s*=/gi,
                    /(?:const|let|var)\s*```math[^```]+```\s*=/gi
                ],
                category: 'js',
                subcategory: 'syntax',
                riskLevel: 'safe',
                description: 'Destructuring Assignment',
                commonUseCases: ['Extract values', 'Function parameters']
            },
            
            {
                id: 'spread-operator',
                aliases: ['spread-syntax'],
                patterns: [
                    /\.{3}(?=[a-zA-Z_$])/g // ... followed by identifier
                ],
                category: 'js',
                subcategory: 'syntax',
                riskLevel: 'safe',
                complementary: ['destructuring'],
                description: 'Spread Operator (...)',
                commonUseCases: ['Array/object copying', 'Function arguments']
            },
            
            {
                id: 'es6-modules',
                aliases: ['import-export', 'esm'],
                patterns: [
                    /\bimport\s+(?:[\w{},*\s]+\s+from\s+)?['"]/gi,
                    /\bexport\s+(?:default\s+)?(?:const|let|var|function|class)/gi,
                    /\bexport\s+\{/gi
                ],
                category: 'js',
                subcategory: 'modules',
                riskLevel: 'safe',
                description: 'ES6 Modules (import/export)',
                commonUseCases: ['Code organization', 'Dependency management']
            },
            
            {
                id: 'array-methods',
                aliases: ['array-iteration-methods'],
                patterns: [
                    /\.(?:map|filter|reduce|find|findIndex|some|every|forEach|includes|flat|flatMap)\s*KATEX_INLINE_OPEN/gi
                ],
                category: 'js',
                subcategory: 'arrays',
                riskLevel: 'safe',
                description: 'Modern Array Methods',
                commonUseCases: ['Data transformation', 'Array manipulation']
            }
        ];
        
        // Register all patterns
        definitions.forEach(def => this.registerPattern(def));
    }
    
    private registerPattern(definition: FeaturePatternDefinition): void {
        // Store main definition
        this.patterns.set(definition.id, definition);
        
        // Register aliases
        definition.aliases.forEach(alias => {
            this.aliasMap.set(alias.toLowerCase(), definition.id);
        });
        
        // Also map the ID itself
        this.aliasMap.set(definition.id.toLowerCase(), definition.id);
    }
    
    private buildIndices(): void {
        // Build category index
        this.patterns.forEach((def, id) => {
            if (!this.categoryIndex.has(def.category)) {
                this.categoryIndex.set(def.category, new Set());
            }
            this.categoryIndex.get(def.category)!.add(id);
        });
    }
    
    // ==========================================
    // PUBLIC API
    // ==========================================
    
    /**
     * Get pattern definition by ID or alias
     */
    public getPattern(idOrAlias: string): FeaturePatternDefinition | undefined {
        const normalizedId = idOrAlias.toLowerCase();
        
        // Try direct lookup
        if (this.patterns.has(normalizedId)) {
            return this.patterns.get(normalizedId);
        }
        
        // Try alias lookup
        const primaryId = this.aliasMap.get(normalizedId);
        if (primaryId) {
            return this.patterns.get(primaryId);
        }
        
        return undefined;
    }
    
    /**
     * Get all patterns for a category
     */
    public getPatternsByCategory(category: 'css' | 'js' | 'html' | 'api'): FeaturePatternDefinition[] {
        const ids = this.categoryIndex.get(category) || new Set();
        return Array.from(ids).map(id => this.patterns.get(id)!);
    }
    
    /**
     * Get all patterns
     */
    public getAllPatterns(): FeaturePatternDefinition[] {
        return Array.from(this.patterns.values());
    }
    
    /**
     * Detect features in text
     */
    public detectFeatures(text: string, languageId?: string): Map<string, number> {
        const detected = new Map<string, number>();
        
        // Filter patterns by language if provided
        let patternsToCheck = Array.from(this.patterns.values());
        if (languageId) {
            const category = this.languageToCategory(languageId);
            if (category) {
                patternsToCheck = patternsToCheck.filter(p => 
                    p.category === category || category === 'html' // HTML can contain both CSS and JS
                );
            }
        }
        
        // Check each pattern
        patternsToCheck.forEach(pattern => {
            let totalMatches = 0;
            
            pattern.patterns.forEach(regex => {
                const matches = Array.from(text.matchAll(regex));
                totalMatches += matches.length;
            });
            
            if (totalMatches > 0) {
                detected.set(pattern.id, totalMatches);
            }
        });
        
        return detected;
    }
    
    /**
     * Resolve feature ID (handles aliases)
     */
    public resolveFeatureId(idOrAlias: string): string | undefined {
        const normalizedId = idOrAlias.toLowerCase();
        return this.aliasMap.get(normalizedId);
    }
    
    /**
     * Get alternatives for a feature
     */
    public getAlternatives(featureId: string): string[] {
        const pattern = this.getPattern(featureId);
        return pattern?.alternatives || [];
    }
    
    /**
     * Get complementary features
     */
    public getComplementary(featureId: string): string[] {
        const pattern = this.getPattern(featureId);
        return pattern?.complementary || [];
    }
    
    /**
     * Get upgrade path
     */
    public getUpgradePath(featureId: string): string | undefined {
        const pattern = this.getPattern(featureId);
        return pattern?.upgradeTo;
    }
    
    /**
     * Check if feature is safe to use
     */
    public isSafe(featureId: string): boolean {
        const pattern = this.getPattern(featureId);
        return pattern?.riskLevel === 'safe';
    }
    
    private languageToCategory(languageId: string): 'css' | 'js' | 'html' | null {
        const cssLangs = ['css', 'scss', 'sass', 'less', 'stylus'];
        const jsLangs = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
        const htmlLangs = ['html', 'vue', 'svelte'];
        
        if (cssLangs.includes(languageId)) return 'css';
        if (jsLangs.includes(languageId)) return 'js';
        if (htmlLangs.includes(languageId)) return 'html';
        
        return null;
    }
}