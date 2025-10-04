// Centralized mapping of pattern keys to actual web-features IDs
export const FEATURE_ID_MAPPING = new Map([
    // CSS mappings - these must match actual web-features IDs
    ['grid', 'grid'],  // CSS Grid
    ['flexbox', 'flexbox'],  // Flexbox
    ['container-queries', 'container-queries'],  // Container Queries
    ['subgrid', 'subgrid'],  // Subgrid
    ['css-has', 'has'],  // :has() selector
    ['css-nesting', 'css-nesting'],  // CSS Nesting
    ['cascade-layers', 'cascade-layers'],  // @layer
    ['aspect-ratio', 'aspect-ratio'],  // aspect-ratio property
    ['gap', 'gap'],  // gap property
    ['custom-properties', 'custom-properties'],  // CSS Variables
    ['clamp', 'clamp'],  // clamp() function
    ['backdrop-filter', 'backdrop-filter'],  // backdrop-filter
    ['scroll-snap', 'scroll-snap'],  // scroll-snap
    ['sticky', 'position-sticky'],  // position: sticky
    ['transforms', 'transforms-2d'],  // CSS Transforms
    ['animations', 'css-animations'],  // CSS Animations
    ['transitions', 'css-transitions'],  // CSS Transitions
    
    // JS API mappings
    ['intersection-observer', 'intersectionobserver'],
    ['fetch-api', 'fetch'],
    ['web-components', 'custom-elements'],
    ['promises', 'promises'],
    ['es-modules', 'es6-module'],
    ['array-methods', 'array-find'],
    ['optional-chaining', 'optional-chaining'],
    ['destructuring', 'destructuring']
]);

// Centralized alternative mappings
export const ALTERNATIVES_MAPPING: Record<string, string[]> = {
    'subgrid': ['grid', 'flexbox'],
    'container-queries': ['media-queries', 'clamp', 'viewport-units'],
    'css-has': ['css-not', 'css-is', 'css-where'],
    'backdrop-filter': ['filter', 'background-blur'],
    'gap': ['margin', 'padding', 'spacer-elements'],
    'aspect-ratio': ['padding-hack', 'viewport-units'],
    'scroll-snap': ['scroll-behavior', 'intersection-observer'],
    'css-nesting': ['sass-nesting', 'postcss'],
    'cascade-layers': ['css-specificity', 'important'],
    'color-mix': ['css-variables', 'preprocessor-functions']
};

// Centralized upgrade mappings
export const UPGRADES_MAPPING: Record<string, string> = {
    'flexbox': 'grid',
    'float': 'flexbox',
    'table-layout': 'grid',
    'css-variables': 'css-custom-properties',
    'webkit-transform': 'transform',
    'moz-border-radius': 'border-radius'
};