import { PrismaClient } from '@prisma/client';
import { config } from '@/config/environment';
import { databaseLogger } from '@/services/logger';

// Prisma client singleton
let prisma: PrismaClient;

// Database connection configuration
const databaseConfig = {
  datasources: {
    db: {
      url: config.DATABASE_URL
    }
  },
  log: config.IS_DEVELOPMENT
    ? [
        { emit: 'event' as const, level: 'query' as const },
        { emit: 'event' as const, level: 'error' as const },
        { emit: 'event' as const, level: 'warn' as const },
        { emit: 'event' as const, level: 'info' as const }
      ]
    : [
        { emit: 'event' as const, level: 'error' as const },
        { emit: 'event' as const, level: 'warn' as const }
    ],
  errorFormat: 'pretty' as const
};

export async function setupDatabase(): Promise<PrismaClient> {
  try {
    databaseLogger.info('Initializing database connection');

    // Create Prisma client instance
    prisma = new PrismaClient(databaseConfig);

    // Setup logging event handlers
    // Note: Prisma logging is disabled for now due to type issues
    // if (config.IS_DEVELOPMENT) {
    //   prisma.$on('query', (e: any) => {
    //     databaseLogger.debug('Database query executed', {
    //       query: e.query,
    //       params: e.params,
    //       duration: `${e.duration}ms`,
    //       timestamp: e.timestamp
    //     });
    //   });
    // }

    // prisma.$on('error', (e: any) => {
    //   databaseLogger.error('Database error occurred', {
    //     target: e.target,
    //     timestamp: e.timestamp
    //   });
    // });

    // prisma.$on('warn', (e: any) => {
    //   databaseLogger.warn('Database warning', {
    //     target: e.target,
    //     timestamp: e.timestamp
    //   });
    // });

    // prisma.$on('info', (e: any) => {
    //   databaseLogger.info('Database info', {
    //     target: e.target,
    //     timestamp: e.timestamp
    //   });
    // });

    // Test database connection
    await testDatabaseConnection();

    databaseLogger.info('Database connection established successfully');
    return prisma;

  } catch (error) {
    databaseLogger.error('Failed to setup database connection', error as Error);
    throw new Error(`Database setup failed: ${(error as Error).message}`);
  }
}

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    databaseLogger.debug('Testing database connection');

    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`;

    databaseLogger.debug('Database connection test successful');
    return true;

  } catch (error) {
    databaseLogger.error('Database connection test failed', error as Error, {
      operation: 'connection_test'
    });
    return false;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  try {
    if (prisma) {
      databaseLogger.info('Closing database connection');
      await prisma.$disconnect();
      databaseLogger.info('Database connection closed successfully');
    }
  } catch (error) {
    databaseLogger.error('Error closing database connection', error as Error);
    throw error;
  }
}

// Database health check
export async function getDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  details: {
    connected: boolean;
    responseTime: number;
    error?: string;
  };
}> {
  const startTime = Date.now();

  try {
    // Test connection with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database health check timeout')), 5000);
    });

    const healthCheckPromise = prisma.$queryRaw`SELECT 1 as health_check`;

    await Promise.race([healthCheckPromise, timeoutPromise]);

    const responseTime = Date.now() - startTime;

    databaseLogger.debug('Database health check completed', {
      responseTime,
      status: 'healthy'
    });

    return {
      status: 'healthy',
      details: {
        connected: true,
        responseTime
      }
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = (error as Error).message;

    databaseLogger.warn('Database health check failed', {
      responseTime,
      error: errorMessage,
      status: 'unhealthy'
    });

    return {
      status: 'unhealthy',
      details: {
        connected: false,
        responseTime,
        error: errorMessage
      }
    };
  }
}

// Transaction helper with logging
export async function executeTransaction<T>(
  operation: string,
  transactionFn: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();

  try {
    databaseLogger.debug(`Starting transaction: ${operation}`, context);

    const result = await prisma.$transaction(transactionFn);

    const duration = Date.now() - startTime;
    databaseLogger.debug(`Transaction completed: ${operation}`, {
      ...context,
      duration
    });

    return result;

  } catch (error) {
    const duration = Date.now() - startTime;
    databaseLogger.error(`Transaction failed: ${operation}`, error as Error, {
      ...context,
      duration
    });
    throw error;
  }
}

// Database metrics helper
export async function getDatabaseMetrics(): Promise<{
  connections: number;
  activeQueries: number;
  avgQueryTime: number;
  uptime: number;
}> {
  try {
    // This would typically require database-specific queries
    // For now, return placeholder metrics
    return {
      connections: 1,
      activeQueries: 0,
      avgQueryTime: 0,
      uptime: process.uptime()
    };
  } catch (error) {
    databaseLogger.error('Failed to get database metrics', error as Error);
    throw error;
  }
}

// Getter function to access initialized prisma client
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    throw new Error('Database not initialized. Call setupDatabase() first.');
  }
  return prisma;
}

// Export the setup function and utilities
export { prisma };
export default setupDatabase;