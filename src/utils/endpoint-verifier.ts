/**
 * Endpoint Verification Utility
 *
 * This utility verifies that all endpoints match expected patterns and
 * provides comprehensive documentation of the API surface.
 */

import { FastifyInstance } from 'fastify';
import { apiLogger } from '@/services/logger';

export interface EndpointInfo {
  method: string;
  url: string;
  schema?: any;
  tags?: string[];
  summary?: string;
  description?: string;
}

export interface RouteVerificationResult {
  module: string;
  endpoints: EndpointInfo[];
  totalEndpoints: number;
  hasLegacySupport: boolean;
  issues: string[];
}

export class EndpointVerifier {
  private app: FastifyInstance;

  constructor(app: FastifyInstance) {
    this.app = app;
  }

  /**
   * Verify all registered routes and their compatibility
   */
  async verifyAllRoutes(): Promise<{
    routes: RouteVerificationResult[];
    summary: {
      totalEndpoints: number;
      totalModules: number;
      legacySupportCount: number;
      issues: string[];
    };
  }> {
    const verification: RouteVerificationResult[] = [];
    let totalEndpoints = 0;
    let legacySupportCount = 0;
    const allIssues: string[] = [];

    // Get all registered routes
    const routes = this.app.printRoutes();
    const routesByModule = this.groupRoutesByModule(routes);

    for (const [module, moduleRoutes] of Object.entries(routesByModule)) {
      const endpoints: EndpointInfo[] = [];
      const issues: string[] = [];
      let hasLegacySupport = false;

      for (const route of moduleRoutes) {
        const endpoint: EndpointInfo = {
          method: route.method,
          url: route.url,
          schema: route.schema,
          tags: route.schema?.tags,
          summary: route.schema?.summary,
          description: route.schema?.description
        };

        endpoints.push(endpoint);

        // Check for legacy compatibility
        if (route.url.includes('/tool-calls') ||
            route.url.includes('/symbols') ||
            route.url.includes('/trading/') ||
            route.tags?.includes('Legacy Compatibility')) {
          hasLegacySupport = true;
        }

        // Validate endpoint structure
        this.validateEndpoint(endpoint, issues);
      }

      if (hasLegacySupport) {
        legacySupportCount++;
      }

      verification.push({
        module,
        endpoints,
        totalEndpoints: endpoints.length,
        hasLegacySupport,
        issues
      });

      totalEndpoints += endpoints.length;
      allIssues.push(...issues);
    }

    return {
      routes: verification,
      summary: {
        totalEndpoints,
        totalModules: verification.length,
        legacySupportCount,
        issues: allIssues
      }
    };
  }

  /**
   * Group routes by module/prefix
   */
  private groupRoutesByModule(routes: string): Record<string, any[]> {
    const routeLines = routes.split('\n').filter(line => line.trim());
    const moduleGroups: Record<string, any[]> = {};

    for (const line of routeLines) {
      const match = line.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(\S+)/);
      if (match) {
        const [, method, url] = match;

        // Determine module from URL pattern
        let module = 'root';
        if (url.startsWith('/api/market')) module = 'market-data';
        else if (url.startsWith('/api/conversations')) module = 'conversations';
        else if (url.startsWith('/api/strategies')) module = 'strategies';
        else if (url.startsWith('/api/backtest')) module = 'backtest';
        else if (url.startsWith('/api/paper')) module = 'paper-trading';
        else if (url.startsWith('/api/live')) module = 'live-trading';
        else if (url.startsWith('/api/analytics')) module = 'performance-analytics';
        else if (url.startsWith('/api/risk')) module = 'risk-management';
        else if (url.startsWith('/api/tools')) module = 'tool-approval';
        else if (url.includes('tool-calls') || url.includes('symbols') || url.includes('trading/status')) module = 'legacy-compatibility';
        else if (url.startsWith('/api')) module = 'api-root';
        else if (url.startsWith('/ws')) module = 'websocket';
        else if (url.startsWith('/health')) module = 'health';

        if (!moduleGroups[module]) {
          moduleGroups[module] = [];
        }

        moduleGroups[module].push({
          method,
          url,
          schema: {}, // Would need app instance to get actual schema
          tags: this.inferTags(url, module)
        });
      }
    }

    return moduleGroups;
  }

  /**
   * Infer tags from URL and module
   */
  private inferTags(url: string, module: string): string[] {
    const tags: string[] = [];

    if (module === 'legacy-compatibility') tags.push('Legacy Compatibility');
    else if (module === 'conversations') tags.push('Conversations');
    else if (module === 'strategies') tags.push('Strategies');
    else if (module === 'backtest') tags.push('Backtesting');
    else if (module === 'paper-trading') tags.push('Paper Trading');
    else if (module === 'live-trading') tags.push('Live Trading');
    else if (module === 'market-data') tags.push('Market Data');
    else if (module === 'performance-analytics') tags.push('Performance Analytics');
    else if (module === 'risk-management') tags.push('Risk Management');
    else if (module === 'tool-approval') tags.push('Tools');
    else if (module === 'health') tags.push('Health');
    else if (module === 'websocket') tags.push('WebSocket');

    return tags;
  }

  /**
   * Validate individual endpoint structure
   */
  private validateEndpoint(endpoint: EndpointInfo, issues: string[]): void {
    // Check for required documentation
    if (!endpoint.summary) {
      issues.push(`${endpoint.method} ${endpoint.url}: Missing summary`);
    }

    if (!endpoint.tags || endpoint.tags.length === 0) {
      issues.push(`${endpoint.method} ${endpoint.url}: Missing tags`);
    }

    // Check for consistent URL patterns
    if (endpoint.url.startsWith('/api/') && !endpoint.url.match(/^\/api\/[a-z-]+/)) {
      issues.push(`${endpoint.method} ${endpoint.url}: Inconsistent URL pattern`);
    }

    // Check for legacy endpoint compatibility
    const legacyPatterns = ['/api/symbols', '/api/trading/', '/api/tool-calls'];
    const isLegacyEndpoint = legacyPatterns.some(pattern => endpoint.url.includes(pattern));

    if (isLegacyEndpoint && !endpoint.tags?.includes('Legacy Compatibility')) {
      issues.push(`${endpoint.method} ${endpoint.url}: Legacy endpoint missing compatibility tag`);
    }
  }

  /**
   * Check for specific endpoint requirements
   */
  async verifyRequiredEndpoints(): Promise<{
    required: string[];
    missing: string[];
    present: string[];
  }> {
    const requiredEndpoints = [
      // Health & Status
      'GET /health',
      'GET /api/',
      'GET /api/status',

      // Conversations
      'POST /api/conversations',
      'GET /api/conversations/:conversationId',
      'POST /api/conversations/:conversationId/messages',
      'GET /api/users/:userId/conversations',
      'PUT /api/conversations/:conversationId/archive',
      'GET /api/conversations/stats',

      // Strategies
      'GET /api/strategies',
      'POST /api/strategies',
      'GET /api/strategies/:id',
      'PUT /api/strategies/:id',
      'DELETE /api/strategies/:id',

      // Backtesting
      'POST /api/backtest',
      'GET /api/backtest/:id',
      'GET /api/backtest',

      // Paper Trading
      'GET /api/paper/account',
      'POST /api/paper/orders',
      'GET /api/paper/orders',
      'GET /api/paper/positions',

      // Live Trading
      'GET /api/live/status',
      'GET /api/live/balance',
      'POST /api/live/orders',
      'GET /api/live/orders',

      // Market Data
      'GET /api/market/symbols',
      'GET /api/market/candles',
      'GET /api/market/ticker',

      // Tools
      'GET /api/tools',
      'POST /api/tools/:id/approve',
      'POST /api/tools/:id/reject',

      // Legacy Compatibility
      'GET /api/symbols',
      'GET /api/trading/status',
      'GET /api/trading/history',
      'GET /api/tool-calls',
      'POST /api/tool-calls',

      // WebSocket
      'GET /ws',
      'GET /ws/authenticated'
    ];

    const routes = this.app.printRoutes();
    const presentEndpoints = this.extractEndpoints(routes);

    const missing = requiredEndpoints.filter(endpoint => !presentEndpoints.includes(endpoint));
    const present = requiredEndpoints.filter(endpoint => presentEndpoints.includes(endpoint));

    return {
      required: requiredEndpoints,
      missing,
      present
    };
  }

  /**
   * Extract endpoint strings from route output
   */
  private extractEndpoints(routes: string): string[] {
    const routeLines = routes.split('\n').filter(line => line.trim());
    const endpoints: string[] = [];

    for (const line of routeLines) {
      const match = line.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(\S+)/);
      if (match) {
        const [, method, url] = match;
        endpoints.push(`${method} ${url}`);
      }
    }

    return endpoints;
  }

  /**
   * Generate endpoint compatibility report
   */
  async generateCompatibilityReport(): Promise<string> {
    const verification = await this.verifyAllRoutes();
    const requiredCheck = await this.verifyRequiredEndpoints();

    let report = `# API Endpoint Compatibility Report\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    report += `## Summary\n`;
    report += `- Total Endpoints: ${verification.summary.totalEndpoints}\n`;
    report += `- Total Modules: ${verification.summary.totalModules}\n`;
    report += `- Modules with Legacy Support: ${verification.summary.legacySupportCount}\n`;
    report += `- Required Endpoints Present: ${requiredCheck.present.length}/${requiredCheck.required.length}\n`;
    report += `- Issues Found: ${verification.summary.issues.length}\n\n`;

    if (requiredCheck.missing.length > 0) {
      report += `## Missing Required Endpoints\n`;
      for (const endpoint of requiredCheck.missing) {
        report += `- ❌ ${endpoint}\n`;
      }
      report += `\n`;
    }

    report += `## Route Modules\n`;
    for (const module of verification.routes) {
      report += `### ${module.module}\n`;
      report += `- Endpoints: ${module.totalEndpoints}\n`;
      report += `- Legacy Support: ${module.hasLegacySupport ? '✅' : '❌'}\n`;

      if (module.issues.length > 0) {
        report += `- Issues: ${module.issues.length}\n`;
        for (const issue of module.issues) {
          report += `  - ${issue}\n`;
        }
      }

      report += `\n#### Endpoints\n`;
      for (const endpoint of module.endpoints) {
        report += `- ${endpoint.method} ${endpoint.url}`;
        if (endpoint.summary) report += ` - ${endpoint.summary}`;
        report += `\n`;
      }
      report += `\n`;
    }

    return report;
  }
}

/**
 * Standalone verification function for use in testing
 */
export async function verifyEndpointParity(app: FastifyInstance): Promise<void> {
  const verifier = new EndpointVerifier(app);

  apiLogger.info('Starting endpoint parity verification...');

  const verification = await verifier.verifyAllRoutes();
  const requiredCheck = await verifier.verifyRequiredEndpoints();

  apiLogger.info('Endpoint verification completed', {
    totalEndpoints: verification.summary.totalEndpoints,
    totalModules: verification.summary.totalModules,
    legacySupportCount: verification.summary.legacySupportCount,
    issuesCount: verification.summary.issues.length,
    missingRequired: requiredCheck.missing.length
  });

  if (requiredCheck.missing.length > 0) {
    apiLogger.warn('Missing required endpoints:', requiredCheck.missing);
  }

  if (verification.summary.issues.length > 0) {
    apiLogger.warn('Endpoint issues found:', verification.summary.issues);
  }

  // Generate and log report
  const report = await verifier.generateCompatibilityReport();
  console.log('\n' + report);
}