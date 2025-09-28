/**
 * Contract Tests for API Endpoint Behavior Validation
 *
 * These tests verify that all endpoints behave as expected and maintain
 * compatibility with the legacy JavaScript backend.
 */

import { FastifyInstance } from 'fastify';
import { createApp } from '@/app';

interface ContractTest {
  name: string;
  endpoint: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    payload?: any;
    query?: Record<string, any>;
  };
  expectations: {
    statusCode: number | number[];
    responseSchema?: any;
    responseContains?: string[];
    responseType?: 'json' | 'text';
    timing?: number; // max response time in ms
  };
  isLegacy?: boolean;
}

interface TestResult {
  test: ContractTest;
  passed: boolean;
  actualStatusCode: number;
  responseTime: number;
  errors: string[];
  response?: any;
}

interface ContractTestSuite {
  suiteName: string;
  tests: ContractTest[];
}

class ContractTester {
  private app: FastifyInstance | null = null;

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Fastify app for contract testing...');

    // Create app without starting server
    this.app = await createApp();
    console.log('✅ Fastify app initialized successfully');
  }

  async runContractTests(): Promise<{
    totalTests: number;
    passedTests: number;
    failedTests: number;
    results: TestResult[];
    summary: string;
  }> {
    if (!this.app) {
      throw new Error('App not initialized. Call initialize() first.');
    }

    const testSuites = this.getTestSuites();
    const allResults: TestResult[] = [];

    for (const suite of testSuites) {
      console.log(`\n📋 Running test suite: ${suite.suiteName}`);

      for (const test of suite.tests) {
        const result = await this.runSingleTest(test);
        allResults.push(result);

        const status = result.passed ? '✅' : '❌';
        console.log(`  ${status} ${test.name} (${result.responseTime}ms)`);

        if (!result.passed) {
          result.errors.forEach(error => {
            console.log(`    🔴 ${error}`);
          });
        }
      }
    }

    const passedTests = allResults.filter(r => r.passed).length;
    const failedTests = allResults.length - passedTests;

    const summary = this.generateSummary(allResults);

    return {
      totalTests: allResults.length,
      passedTests,
      failedTests,
      results: allResults,
      summary
    };
  }

  private async runSingleTest(test: ContractTest): Promise<TestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let actualStatusCode = 0;
    let response: any = null;

    try {
      const result = await this.app!.inject({
        method: test.endpoint.method as any,
        url: test.endpoint.url,
        headers: test.endpoint.headers,
        query: test.endpoint.query,
        payload: test.endpoint.payload
      });

      actualStatusCode = result.statusCode;
      const responseTime = Date.now() - startTime;

      // Parse response if JSON
      try {
        response = JSON.parse(result.payload);
      } catch {
        response = result.payload;
      }

      // Validate status code
      const expectedCodes = Array.isArray(test.expectations.statusCode)
        ? test.expectations.statusCode
        : [test.expectations.statusCode];

      if (!expectedCodes.includes(actualStatusCode)) {
        errors.push(`Expected status ${expectedCodes.join(' or ')}, got ${actualStatusCode}`);
      }

      // Validate response timing
      if (test.expectations.timing && responseTime > test.expectations.timing) {
        errors.push(`Response too slow: ${responseTime}ms > ${test.expectations.timing}ms`);
      }

      // Validate response contains expected strings
      if (test.expectations.responseContains) {
        const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
        for (const expectedString of test.expectations.responseContains) {
          if (!responseStr.includes(expectedString)) {
            errors.push(`Response missing expected string: "${expectedString}"`);
          }
        }
      }

      // Validate response schema for successful responses
      if (actualStatusCode < 400 && test.expectations.responseSchema) {
        const schemaErrors = this.validateResponseSchema(response, test.expectations.responseSchema);
        errors.push(...schemaErrors);
      }

      // Validate response type
      if (test.expectations.responseType === 'json') {
        if (typeof response !== 'object') {
          errors.push('Expected JSON response, got non-object');
        }
      }

      return {
        test,
        passed: errors.length === 0,
        actualStatusCode,
        responseTime,
        errors,
        response
      };

    } catch (error) {
      return {
        test,
        passed: false,
        actualStatusCode: 0,
        responseTime: Date.now() - startTime,
        errors: [`Test execution failed: ${error}`],
        response: null
      };
    }
  }

  private validateResponseSchema(response: any, schema: any): string[] {
    const errors: string[] = [];

    // Simple schema validation
    if (schema.type === 'object' && typeof response !== 'object') {
      errors.push('Expected object response');
      return errors;
    }

    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties as any)) {
        if (!(key in response)) {
          if (schema.required && schema.required.includes(key)) {
            errors.push(`Missing required property: ${key}`);
          }
          continue;
        }

        const value = response[key];
        const expectedType = (propSchema as any).type;

        if (expectedType && typeof value !== expectedType) {
          errors.push(`Property ${key}: expected ${expectedType}, got ${typeof value}`);
        }
      }
    }

    return errors;
  }

  private getTestSuites(): ContractTestSuite[] {
    return [
      {
        suiteName: 'Health Endpoints',
        tests: [
          {
            name: 'Health check endpoint',
            endpoint: { method: 'GET', url: '/health' },
            expectations: {
              statusCode: 200,
              responseType: 'json',
              responseContains: ['success', 'status'],
              timing: 1000
            }
          },
          {
            name: 'API root endpoint',
            endpoint: { method: 'GET', url: '/api/' },
            expectations: {
              statusCode: 200,
              responseType: 'json',
              responseContains: ['DQuant', 'TypeScript'],
              timing: 500
            }
          },
          {
            name: 'API status endpoint',
            endpoint: { method: 'GET', url: '/api/status' },
            expectations: {
              statusCode: 200,
              responseType: 'json',
              responseContains: ['operational', 'uptime'],
              timing: 500
            }
          }
        ]
      },
      {
        suiteName: 'Legacy Compatibility',
        tests: [
          {
            name: 'Legacy symbols endpoint',
            endpoint: { method: 'GET', url: '/api/symbols' },
            expectations: {
              statusCode: 200,
              responseType: 'json',
              responseContains: ['success', 'symbols', 'BTCUSDT'],
              timing: 1000
            },
            isLegacy: true
          },
          {
            name: 'Legacy trading status',
            endpoint: { method: 'GET', url: '/api/trading/status' },
            expectations: {
              statusCode: 200,
              responseType: 'json',
              responseContains: ['operational', 'timestamp'],
              timing: 1000
            },
            isLegacy: true
          },
          {
            name: 'Legacy trading history',
            endpoint: { method: 'GET', url: '/api/trading/history' },
            expectations: {
              statusCode: 200,
              responseType: 'json',
              responseContains: ['trades', 'total'],
              timing: 1000
            },
            isLegacy: true
          },
          {
            name: 'Legacy tool calls list',
            endpoint: { method: 'GET', url: '/api/tool-calls' },
            expectations: {
              statusCode: 200,
              responseType: 'json',
              responseContains: ['pendingCalls', 'total'],
              timing: 1000
            },
            isLegacy: true
          },
          {
            name: 'Legacy tool call creation',
            endpoint: {
              method: 'POST',
              url: '/api/tool-calls',
              payload: { tool: 'test', params: {} }
            },
            expectations: {
              statusCode: 201,
              responseType: 'json',
              responseContains: ['callId', 'status'],
              timing: 1000
            },
            isLegacy: true
          },
          {
            name: 'Legacy compatibility info',
            endpoint: { method: 'GET', url: '/api/compatibility' },
            expectations: {
              statusCode: 200,
              responseType: 'json',
              responseContains: ['legacyRoutes', 'recommendations'],
              timing: 500
            },
            isLegacy: true
          }
        ]
      },
      {
        suiteName: 'Core API Endpoints',
        tests: [
          {
            name: 'Conversations stats',
            endpoint: { method: 'GET', url: '/api/conversations/stats' },
            expectations: {
              statusCode: 200,
              responseType: 'json',
              timing: 2000
            }
          },
          {
            name: 'Strategies list',
            endpoint: { method: 'GET', url: '/api/strategies' },
            expectations: {
              statusCode: 200,
              responseType: 'json',
              timing: 2000
            }
          },
          {
            name: 'Backtest list',
            endpoint: { method: 'GET', url: '/api/backtest' },
            expectations: {
              statusCode: 200,
              responseType: 'json',
              timing: 2000
            }
          },
          {
            name: 'Paper trading account',
            endpoint: { method: 'GET', url: '/api/paper/account' },
            expectations: {
              statusCode: [200, 404], // May not exist
              responseType: 'json',
              timing: 2000
            }
          },
          {
            name: 'Live trading status',
            endpoint: { method: 'GET', url: '/api/live/status' },
            expectations: {
              statusCode: 200,
              responseType: 'json',
              timing: 3000
            }
          },
          {
            name: 'Market symbols',
            endpoint: { method: 'GET', url: '/api/market/symbols' },
            expectations: {
              statusCode: 200,
              responseType: 'json',
              timing: 3000
            }
          },
          {
            name: 'Tools list',
            endpoint: { method: 'GET', url: '/api/tools' },
            expectations: {
              statusCode: 200,
              responseType: 'json',
              timing: 1000
            }
          }
        ]
      },
      {
        suiteName: 'Error Handling',
        tests: [
          {
            name: 'Invalid endpoint returns 404',
            endpoint: { method: 'GET', url: '/api/nonexistent' },
            expectations: {
              statusCode: 404,
              timing: 500
            }
          },
          {
            name: 'Invalid conversation ID returns 400',
            endpoint: { method: 'GET', url: '/api/conversations/invalid-uuid' },
            expectations: {
              statusCode: [400, 404],
              timing: 1000
            }
          },
          {
            name: 'Invalid strategy ID returns 404',
            endpoint: { method: 'GET', url: '/api/strategies/nonexistent' },
            expectations: {
              statusCode: 404,
              timing: 1000
            }
          }
        ]
      }
    ];
  }

  private generateSummary(results: TestResult[]): string {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const legacyTests = results.filter(r => r.test.isLegacy);
    const legacyPassed = legacyTests.filter(r => r.passed).length;

    let summary = `# Contract Test Results Summary\n\n`;
    summary += `## Overall Results\n`;
    summary += `- **Total Tests**: ${results.length}\n`;
    summary += `- **Passed**: ${passed} ✅\n`;
    summary += `- **Failed**: ${failed} ❌\n`;
    summary += `- **Success Rate**: ${Math.round((passed / results.length) * 100)}%\n\n`;

    summary += `## Legacy Compatibility\n`;
    summary += `- **Legacy Tests**: ${legacyTests.length}\n`;
    summary += `- **Legacy Passed**: ${legacyPassed} ✅\n`;
    summary += `- **Legacy Success Rate**: ${legacyTests.length > 0 ? Math.round((legacyPassed / legacyTests.length) * 100) : 0}%\n\n`;

    if (failed > 0) {
      summary += `## Failed Tests\n`;
      results.filter(r => !r.passed).forEach(result => {
        summary += `- **${result.test.name}**: ${result.errors.join(', ')}\n`;
      });
      summary += `\n`;
    }

    summary += `## Performance\n`;
    const avgResponseTime = Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length);
    const slowTests = results.filter(r => r.responseTime > 2000);
    summary += `- **Average Response Time**: ${avgResponseTime}ms\n`;
    summary += `- **Slow Tests (>2s)**: ${slowTests.length}\n`;

    return summary;
  }

  async cleanup(): Promise<void> {
    if (this.app) {
      await this.app.close();
      console.log('✅ Fastify app closed');
    }
  }
}

async function runContractTests(): Promise<void> {
  const tester = new ContractTester();

  try {
    await tester.initialize();

    console.log('\n🧪 Starting Contract Tests...\n');
    const results = await tester.runContractTests();

    console.log('\n' + '='.repeat(60));
    console.log(results.summary);
    console.log('='.repeat(60));

    if (results.failedTests === 0) {
      console.log('\n🎉 ALL CONTRACT TESTS PASSED! 🎉');
      console.log('API endpoints are behaving correctly and maintaining compatibility!');
    } else {
      console.log(`\n⚠️ ${results.failedTests} CONTRACT TEST(S) FAILED`);
      console.log('Some endpoints may not be behaving as expected.');
    }

  } catch (error) {
    console.error('\n❌ Contract testing failed:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runContractTests()
    .then(() => {
      console.log('\n✅ Contract testing completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Contract testing failed:', error);
      process.exit(1);
    });
}

export { ContractTester, runContractTests };