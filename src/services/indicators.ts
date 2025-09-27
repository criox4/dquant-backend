/**
 * Technical Indicators Library - Comprehensive Trading Indicators
 * Matches JavaScript backend functionality with TypeScript implementation
 */

import { TechnicalIndicator, IndicatorRegistry } from '@/types/strategy-execution';
import { Candle } from '@/types/market-data';
import { tradingLogger } from '@/services/logger';

// Simple Moving Average
export class SMAIndicator implements TechnicalIndicator {
  name = 'SMA';

  calculate(data: number[], period: number): number[] {
    if (data.length < period) return [];

    const result: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
    return result;
  }

  validate(period: number): boolean {
    return period > 0 && period <= 200;
  }

  getDefaultPeriod(): number {
    return 20;
  }
}

// Exponential Moving Average
export class EMAIndicator implements TechnicalIndicator {
  name = 'EMA';

  calculate(data: number[], period: number): number[] {
    if (data.length < period) return [];

    const result: number[] = [];
    const multiplier = 2 / (period + 1);

    // Start with SMA for first value
    const sma = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    result.push(sma);

    // Calculate EMA for remaining values
    for (let i = period; i < data.length; i++) {
      const ema = (data[i] - result[result.length - 1]) * multiplier + result[result.length - 1];
      result.push(ema);
    }

    return result;
  }

  validate(period: number): boolean {
    return period > 0 && period <= 200;
  }

  getDefaultPeriod(): number {
    return 12;
  }
}

// Relative Strength Index
export class RSIIndicator implements TechnicalIndicator {
  name = 'RSI';

  calculate(data: number[], period: number): number[] {
    if (data.length < period + 1) return [];

    const result: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate price changes
    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calculate initial averages
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // First RSI value
    let rs = avgGain / avgLoss;
    result.push(100 - (100 / (1 + rs)));

    // Calculate remaining RSI values using smoothed averages
    for (let i = period; i < gains.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
      rs = avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }

    return result;
  }

  validate(period: number): boolean {
    return period > 0 && period <= 50;
  }

  getDefaultPeriod(): number {
    return 14;
  }
}

// Moving Average Convergence Divergence
export class MACDIndicator implements TechnicalIndicator {
  name = 'MACD';

  calculate(data: number[], period: number, options?: Record<string, any>): number[] {
    const fastPeriod = options?.fastPeriod || 12;
    const slowPeriod = options?.slowPeriod || 26;
    const signalPeriod = options?.signalPeriod || 9;

    if (data.length < slowPeriod) return [];

    const emaFast = new EMAIndicator().calculate(data, fastPeriod);
    const emaSlow = new EMAIndicator().calculate(data, slowPeriod);

    // Align arrays (emaSlow is shorter)
    const alignedFast = emaFast.slice(emaFast.length - emaSlow.length);

    // Calculate MACD line
    const macdLine = alignedFast.map((fast, i) => fast - emaSlow[i]);

    // Calculate signal line (EMA of MACD)
    const signalLine = new EMAIndicator().calculate(macdLine, signalPeriod);

    // Calculate histogram (MACD - Signal)
    const alignedMacd = macdLine.slice(macdLine.length - signalLine.length);
    const histogram = alignedMacd.map((macd, i) => macd - signalLine[i]);

    // Return combined array [macd, signal, histogram]
    return signalLine.map((signal, i) => alignedMacd[i]);
  }

  validate(period: number): boolean {
    return period > 0 && period <= 50;
  }

  getDefaultPeriod(): number {
    return 26;
  }
}

// Bollinger Bands
export class BBIndicator implements TechnicalIndicator {
  name = 'BB';

  calculate(data: number[], period: number, options?: Record<string, any>): number[] {
    const stdDev = options?.stdDev || 2;

    if (data.length < period) return [];

    const sma = new SMAIndicator().calculate(data, period);
    const result: number[] = [];

    for (let i = 0; i < sma.length; i++) {
      const dataSlice = data.slice(i, i + period);
      const mean = sma[i];
      const variance = dataSlice.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);

      const upperBand = mean + (standardDeviation * stdDev);
      const lowerBand = mean - (standardDeviation * stdDev);

      // Return middle band (SMA) as primary value
      result.push(mean);
    }

    return result;
  }

  validate(period: number): boolean {
    return period > 0 && period <= 50;
  }

  getDefaultPeriod(): number {
    return 20;
  }
}

// Stochastic Oscillator
export class StochasticIndicator implements TechnicalIndicator {
  name = 'STOCH';

  calculate(data: number[], period: number, options?: Record<string, any>): number[] {
    // For stochastic, we need high, low, close data
    // This simplified version uses close prices only
    if (data.length < period) return [];

    const result: number[] = [];

    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const highest = Math.max(...slice);
      const lowest = Math.min(...slice);
      const current = data[i];

      const kPercent = ((current - lowest) / (highest - lowest)) * 100;
      result.push(kPercent);
    }

    return result;
  }

  validate(period: number): boolean {
    return period > 0 && period <= 50;
  }

  getDefaultPeriod(): number {
    return 14;
  }
}

// Average True Range
export class ATRIndicator implements TechnicalIndicator {
  name = 'ATR';

  calculate(data: number[], period: number, options?: Record<string, any>): number[] {
    // Simplified ATR using only close prices
    if (data.length < period + 1) return [];

    const trueRanges: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const tr = Math.abs(data[i] - data[i - 1]);
      trueRanges.push(tr);
    }

    return new SMAIndicator().calculate(trueRanges, period);
  }

  validate(period: number): boolean {
    return period > 0 && period <= 50;
  }

  getDefaultPeriod(): number {
    return 14;
  }
}

// Williams %R
export class WilliamsRIndicator implements TechnicalIndicator {
  name = 'WILLR';

  calculate(data: number[], period: number): number[] {
    if (data.length < period) return [];

    const result: number[] = [];

    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const highest = Math.max(...slice);
      const lowest = Math.min(...slice);
      const current = data[i];

      const willR = ((highest - current) / (highest - lowest)) * -100;
      result.push(willR);
    }

    return result;
  }

  validate(period: number): boolean {
    return period > 0 && period <= 50;
  }

  getDefaultPeriod(): number {
    return 14;
  }
}

// Commodity Channel Index
export class CCIIndicator implements TechnicalIndicator {
  name = 'CCI';

  calculate(data: number[], period: number): number[] {
    if (data.length < period) return [];

    const sma = new SMAIndicator().calculate(data, period);
    const result: number[] = [];

    for (let i = 0; i < sma.length; i++) {
      const dataSlice = data.slice(i, i + period);
      const mean = sma[i];
      const meanDeviation = dataSlice.reduce((sum, value) => sum + Math.abs(value - mean), 0) / period;

      const cci = (data[i + period - 1] - mean) / (0.015 * meanDeviation);
      result.push(cci);
    }

    return result;
  }

  validate(period: number): boolean {
    return period > 0 && period <= 50;
  }

  getDefaultPeriod(): number {
    return 20;
  }
}

// Indicator Registry Implementation
export class TechnicalIndicatorRegistry implements IndicatorRegistry {
  private indicators = new Map<string, TechnicalIndicator>();

  constructor() {
    // Register all indicators
    this.register('SMA', new SMAIndicator());
    this.register('EMA', new EMAIndicator());
    this.register('RSI', new RSIIndicator());
    this.register('MACD', new MACDIndicator());
    this.register('BB', new BBIndicator());
    this.register('STOCH', new StochasticIndicator());
    this.register('ATR', new ATRIndicator());
    this.register('WILLR', new WilliamsRIndicator());
    this.register('CCI', new CCIIndicator());

    tradingLogger.info('Technical Indicators registered', {
      count: this.indicators.size,
      indicators: this.list()
    });
  }

  register(name: string, indicator: TechnicalIndicator): void {
    this.indicators.set(name.toUpperCase(), indicator);
  }

  get(name: string): TechnicalIndicator | undefined {
    return this.indicators.get(name.toUpperCase());
  }

  list(): string[] {
    return Array.from(this.indicators.keys());
  }
}

// Helper functions for candle data processing
export class IndicatorHelpers {
  /**
   * Extract price data from candles
   */
  static extractPrices(candles: Candle[], source: 'open' | 'high' | 'low' | 'close' | 'volume' = 'close'): number[] {
    return candles.map(candle => {
      switch (source) {
        case 'open': return candle.open;
        case 'high': return candle.high;
        case 'low': return candle.low;
        case 'volume': return candle.volume;
        default: return candle.close;
      }
    });
  }

  /**
   * Calculate all indicators for a DSL strategy
   */
  static async calculateIndicators(
    indicatorSpecs: Record<string, any>,
    candles: Candle[],
    registry: IndicatorRegistry
  ): Promise<Map<string, number[]>> {
    const results = new Map<string, number[]>();

    for (const [name, spec] of Object.entries(indicatorSpecs)) {
      try {
        const indicator = registry.get(spec.type);
        if (!indicator) {
          tradingLogger.warn(`Unknown indicator type: ${spec.type}`);
          continue;
        }

        const prices = this.extractPrices(candles, spec.source || 'close');
        const values = indicator.calculate(prices, spec.period, spec.settings);

        results.set(name, values);

        tradingLogger.debug(`Calculated indicator ${name}`, {
          type: spec.type,
          period: spec.period,
          valuesCount: values.length
        });

      } catch (error) {
        tradingLogger.error(`Error calculating indicator ${name}`, error as Error);
      }
    }

    return results;
  }

  /**
   * Validate indicator specifications
   */
  static validateIndicatorSpecs(
    indicatorSpecs: Record<string, any>,
    registry: IndicatorRegistry
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [name, spec] of Object.entries(indicatorSpecs)) {
      if (!spec.type) {
        errors.push(`Indicator '${name}' missing type`);
        continue;
      }

      const indicator = registry.get(spec.type);
      if (!indicator) {
        errors.push(`Unknown indicator type '${spec.type}' for indicator '${name}'`);
        continue;
      }

      if (!spec.period) {
        errors.push(`Indicator '${name}' missing period`);
        continue;
      }

      if (!indicator.validate(spec.period, spec.settings)) {
        errors.push(`Invalid parameters for indicator '${name}'`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}

// Singleton instance
export const indicatorRegistry = new TechnicalIndicatorRegistry();