import * as vscode from 'vscode';
import { InvertedIndex } from '../core/InvertedIndex';
import { ConfigurationManager } from '../core/ConfigurationManager';
import { Feature } from '../types';

export class BaselineHoverProvider implements vscode.HoverProvider {
    private cache = new Map<string, vscode.Hover>();
    private cacheTimeout: number;

    constructor(
        private index: InvertedIndex,
        private configManager: ConfigurationManager
    ) {
        this.cacheTimeout = configManager.getConfiguration().cacheTimeout;
        
        // Update cache timeout on config change
        configManager.onDidChange((config) => {
            this.cacheTimeout = config.cacheTimeout;
        });
    }

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        const config = this.configManager.getConfiguration();
        
        if (!config.enabled || !config.enableHoverInfo) {
            return undefined;
        }
        
        const range = document.getWordRangeAtPosition(position);
        if (!range) return;

        const word = document.getText(range);
        const cacheKey = `${document.uri.toString()}_${word}_${position.line}`;

        // Check cache
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Search for feature
        const results = await this.index.search(word);
        if (results.length === 0) return;

        const feature = results[0];
        const hover = new vscode.Hover(this.formatFeatureInfo(feature), range);
        
        // Cache result
        this.cache.set(cacheKey, hover);
        setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

        return hover;
    }

    private formatFeatureInfo(feature: Feature): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;

        const status = this.getStatusInfo(feature);
        const config = this.configManager.getConfiguration();
        const targetBrowsers = config.targetBrowsers;
        
        md.appendMarkdown(`## ${status.icon} ${feature.name || feature.id}\n\n`);
        md.appendMarkdown(`**Status:** ${status.label} ${status.badge}\n\n`);

        if (feature.description_html) {
            md.appendMarkdown(`${feature.description_html}\n\n`);
        } else if (feature.description) {
            md.appendMarkdown(`${feature.description}\n\n`);
        }

        // Browser support table (filtered by target browsers)
        if (feature.status?.support) {
            md.appendMarkdown(`### Browser Support (Your Targets)\n\n`);
            md.appendMarkdown(`| Browser | Version |\n`);
            md.appendMarkdown(`|---------|--------|\n`);
            
            Object.entries(feature.status.support)
                .filter(([browser]) => targetBrowsers.includes(browser))
                .forEach(([browser, version]) => {
                    const icon = this.getBrowserIcon(browser);
                    md.appendMarkdown(`| ${icon} ${browser} | ${version}+ |\n`);
                });
            md.appendMarkdown(`\n`);
        }

        // Baseline dates
        if (feature.status?.baseline_low_date) {
            md.appendMarkdown(`📅 **Newly available since:** ${feature.status.baseline_low_date}\n\n`);
        }
        if (feature.status?.baseline_high_date) {
            md.appendMarkdown(`✅ **Widely available since:** ${feature.status.baseline_high_date}\n\n`);
        }

        // Links
        const links: string[] = [];
        if (feature.mdn_url) {
            links.push(`[MDN](${feature.mdn_url})`);
        }
        if (feature.caniuse) {
            links.push(`[Can I Use](https://caniuse.com/${feature.caniuse})`);
        }
        if (feature.spec?.links) {
            feature.spec.links.forEach((link, i) => {
                links.push(`[Spec ${i + 1}](${link})`);
            });
        }
        
        if (links.length > 0) {
            md.appendMarkdown(`**Resources:** ${links.join(' • ')}\n\n`);
        }

        // Quick actions
        md.appendMarkdown(`---\n`);
        md.appendMarkdown(`[$(graph) View in Graph](command:baseline-navigator.showGraph) • `);
        md.appendMarkdown(`[$(search) Find Similar](command:baseline-navigator.findSimilar?${encodeURIComponent(JSON.stringify(feature.id))}) • `);
        md.appendMarkdown(`[$(report) Check Compatibility](command:baseline-navigator.checkCompatibility)`);

        return md;
    }

    private getStatusInfo(feature: Feature): { icon: string; label: string; badge: string } {
        const baseline = feature.status?.baseline || feature.status?.baseline_status;
        
        switch (baseline) {
            case 'widely':
            case 'high':
                return { 
                    icon: '✅', 
                    label: 'Widely Available',
                    badge: '`🟢 STABLE`'
                };
            case 'newly':
            case 'low':
                return { 
                    icon: '⚡', 
                    label: 'Newly Available',
                    badge: '`🟡 NEW`'
                };
            case 'limited':
            case 'false':
                return { 
                    icon: '⚠️', 
                    label: 'Limited Support',
                    badge: '`🔴 LIMITED`'
                };
            default:
                return { 
                    icon: '❓', 
                    label: 'Unknown Status',
                    badge: '`⚪ UNKNOWN`'
                };
        }
    }

    private getBrowserIcon(browser: string): string {
        const icons: Record<string, string> = {
            'chrome': '🌐',
            'firefox': '🦊',
            'safari': '🧭',
            'edge': '🌊',
            'opera': '⭕'
        };
        return icons[browser.toLowerCase()] || '🌐';
    }
}