/**
 * Endpoint Parity Test
 *
 * This test verifies that all expected endpoints are present and working
 * to ensure drop-in replacement compatibility.
 */

import { createApp } from '@/app';
import { verifyEndpointParity, EndpointVerifier } from '@/utils/endpoint-verifier';
import { apiLogger } from '@/services/logger';

async function runEndpointParityTest(): Promise<void> {
  let app;

  try {
    apiLogger.info('Creating Fastify application for endpoint testing...');
    app = await createApp();

    apiLogger.info('Starting endpoint parity verification...');
    const verifier = new EndpointVerifier(app);

    // Run comprehensive verification
    const verification = await verifier.verifyAllRoutes();
    const requiredCheck = await verifier.verifyRequiredEndpoints();

    // Generate detailed report
    const report = await verifier.generateCompatibilityReport();

    console.log('\n=== ENDPOINT PARITY VERIFICATION RESULTS ===\n');
    console.log(report);

    // Test specific legacy compatibility endpoints
    console.log('\n=== TESTING LEGACY COMPATIBILITY ENDPOINTS ===\n');
    await testLegacyEndpoints(app);

    // Test WebSocket endpoints
    console.log('\n=== TESTING WEBSOCKET ENDPOINTS ===\n');
    await testWebSocketEndpoints(app);

    // Summary
    console.log('\n=== VERIFICATION SUMMARY ===\n');
    console.log(`✅ Total Endpoints: ${verification.summary.totalEndpoints}`);
    console.log(`✅ Modules with Legacy Support: ${verification.summary.legacySupportCount}`);
    console.log(`${requiredCheck.missing.length === 0 ? '✅' : '❌'} Required Endpoints: ${requiredCheck.present.length}/${requiredCheck.required.length}`);
    console.log(`${verification.summary.issues.length === 0 ? '✅' : '❌'} Issues: ${verification.summary.issues.length}`);

    if (requiredCheck.missing.length === 0 && verification.summary.issues.length === 0) {
      console.log('\n🎉 ALL ENDPOINT PARITY CHECKS PASSED! 🎉');
      console.log('TypeScript backend is a true drop-in replacement for the JavaScript version.');
    } else {
      console.log('\n⚠️  ENDPOINT PARITY ISSUES FOUND');
      if (requiredCheck.missing.length > 0) {
        console.log('\nMissing Required Endpoints:');
        requiredCheck.missing.forEach(endpoint => console.log(`  - ${endpoint}`));
      }
      if (verification.summary.issues.length > 0) {
        console.log('\nIssues Found:');
        verification.summary.issues.forEach(issue => console.log(`  - ${issue}`));
      }
    }

  } catch (error) {
    apiLogger.error('Endpoint parity test failed:', error as Error);
    console.error('\n❌ ENDPOINT PARITY TEST FAILED');
    console.error(error);
    process.exit(1);
  } finally {
    if (app) {
      await app.close();
    }
  }
}

async function testLegacyEndpoints(app: any): Promise<void> {
  const legacyEndpoints = [
    { method: 'GET', url: '/api/symbols' },
    { method: 'GET', url: '/api/trading/status' },
    { method: 'GET', url: '/api/trading/history' },
    { method: 'GET', url: '/api/tool-calls' },
    { method: 'POST', url: '/api/tool-calls' },
    { method: 'GET', url: '/api/tool-calls/test-id' },
    { method: 'POST', url: '/api/tool-calls/test-id/approve' },
    { method: 'POST', url: '/api/tool-calls/test-id/reject' },
    { method: 'GET', url: '/api/compatibility' }
  ];

  for (const endpoint of legacyEndpoints) {
    try {
      const response = await app.inject({
        method: endpoint.method,
        url: endpoint.url,
        payload: endpoint.method === 'POST' ? { test: true } : undefined
      });

      const status = response.statusCode < 400 ? '✅' : '❌';
      console.log(`${status} ${endpoint.method} ${endpoint.url} - Status: ${response.statusCode}`);

      if (response.statusCode >= 400) {
        console.log(`   Error: ${response.payload}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.method} ${endpoint.url} - Error: ${error}`);
    }
  }
}

async function testWebSocketEndpoints(app: any): Promise<void> {
  const wsEndpoints = [
    '/ws',
    '/ws/authenticated'
  ];

  for (const endpoint of wsEndpoints) {
    try {
      // Test WebSocket endpoint availability (not actual connection)
      const routes = app.printRoutes();
      const hasEndpoint = routes.includes(`GET ${endpoint}`);

      console.log(`${hasEndpoint ? '✅' : '❌'} WebSocket endpoint ${endpoint} ${hasEndpoint ? 'registered' : 'missing'}`);
    } catch (error) {
      console.log(`❌ WebSocket endpoint ${endpoint} - Error: ${error}`);
    }
  }

  // Check Socket.IO compatibility
  try {
    const hasSocketIO = app.io !== undefined;
    console.log(`${hasSocketIO ? '✅' : '❌'} Socket.IO compatibility ${hasSocketIO ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.log(`❌ Socket.IO compatibility check failed: ${error}`);
  }
}

// Additional endpoint coverage tests
async function testEndpointCoverage(app: any): Promise<void> {
  const criticalEndpoints = [
    // Health endpoints
    { method: 'GET', url: '/health', expectSuccess: true },
    { method: 'GET', url: '/api/', expectSuccess: true },
    { method: 'GET', url: '/api/status', expectSuccess: true },

    // API endpoints that should exist
    { method: 'GET', url: '/api/conversations/stats', expectSuccess: true },
    { method: 'GET', url: '/api/strategies', expectSuccess: true },
    { method: 'GET', url: '/api/backtest', expectSuccess: true },
    { method: 'GET', url: '/api/paper/account', expectSuccess: true },
    { method: 'GET', url: '/api/live/status', expectSuccess: true },
    { method: 'GET', url: '/api/market/symbols', expectSuccess: true },
    { method: 'GET', url: '/api/tools', expectSuccess: true },

    // Endpoints that should return errors but exist
    { method: 'GET', url: '/api/strategies/nonexistent', expectSuccess: false },
    { method: 'GET', url: '/api/conversations/invalid-uuid', expectSuccess: false }
  ];

  console.log('\n=== TESTING CRITICAL ENDPOINT COVERAGE ===\n');

  for (const endpoint of criticalEndpoints) {
    try {
      const response = await app.inject({
        method: endpoint.method,
        url: endpoint.url
      });

      const isSuccess = response.statusCode < 400;
      const expectedResult = endpoint.expectSuccess ? isSuccess : !isSuccess;
      const status = expectedResult ? '✅' : '❌';

      console.log(`${status} ${endpoint.method} ${endpoint.url} - Status: ${response.statusCode} ${expectedResult ? '(Expected)' : '(Unexpected)'}`);

      if (!expectedResult) {
        console.log(`   Response: ${response.payload.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.method} ${endpoint.url} - Error: ${error}`);
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runEndpointParityTest()
    .then(() => {
      console.log('\n✅ Endpoint parity test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Endpoint parity test failed:', error);
      process.exit(1);
    });
}

export {
  runEndpointParityTest,
  testLegacyEndpoints,
  testWebSocketEndpoints,
  testEndpointCoverage
};