import {
  DSLStrategy,
  DSLIndicator,
  DSLCondition,
  DSLValidationResult,
  DSLValidationError,
  DSLValidationWarning,
  DSLSuggestion
} from '@/types/strategy';
import {
  dslStrategySchema,
  dslValidationResultSchema,
  supportedIndicators
} from '@/schemas/strategy';
import { OpenRouterService } from '@/services/openrouter';
import { apiLogger, performanceLogger } from '@/services/logger';

export class DSLProcessor {
  private openRouterService: OpenRouterService;
  private supportedTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
  private supportedSymbols = new Set([
    'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'DOT/USDT',
    'XRP/USDT', 'LINK/USDT', 'LTC/USDT', 'BCH/USDT', 'UNI/USDT'
  ]);

  constructor() {
    this.openRouterService = new OpenRouterService();
  }

  private indicatorDefaults: Record<string, Record<string, any>> = {
    SMA: { period: 20 },
    EMA: { period: 20 },
    RSI: { period: 14 },
    MACD: { fast: 12, slow: 26, signal: 9 },
    BB: { period: 20, multiplier: 2 },
    STOCH: { k_period: 14, d_period: 3 },
    ATR: { period: 14 },
    ADX: { period: 14 },
    OBV: {},
    VWAP: {},
    WR: { period: 14 },
    CCI: { period: 20 },
    MFI: { period: 14 },
    KDJ: { k_period: 9, d_period: 3, j_period: 3 },
    DMI: { period: 14 },
    SAR: { step: 0.02, max: 0.2 },
    ICHIMOKU: { conversion: 9, base: 26, span: 52, displacement: 26 },
    VOLUME: {}
  };

  /**
   * Parse natural language into DSL strategy
   */
  async parseNaturalLanguage(
    naturalLanguage: string,
    symbol: string,
    timeframe: string
  ): Promise<DSLStrategy> {
    const timer = performanceLogger.startTimer('dsl_parse_natural_language');

    try {
      apiLogger.info('Parsing natural language to DSL', {
        textLength: naturalLanguage.length,
        symbol,
        timeframe
      });

      // Extract strategy components using pattern matching and AI processing
      const extractedComponents = await this.extractStrategyComponents(naturalLanguage);

      // Build DSL strategy from extracted components
      const dsl: DSLStrategy = {
        strategy_name: extractedComponents.name || `Strategy_${symbol}_${timeframe}`,
        symbol,
        timeframe,
        indicators: extractedComponents.indicators,
        entry: extractedComponents.entry,
        exit: extractedComponents.exit,
        risk: extractedComponents.risk,
        params: extractedComponents.params
      };

      // Validate the generated DSL
      const validation = await this.validateDSL(dsl);
      if (!validation.isValid) {
        throw new Error(`Invalid DSL generated: ${validation.errors[0]?.message}`);
      }

      performanceLogger.endTimer(timer);

      apiLogger.info('Successfully parsed natural language to DSL', {
        strategyName: dsl.strategy_name,
        indicatorCount: dsl.indicators.length,
        entryConditions: dsl.entry.length,
        exitConditions: dsl.exit.length
      });

      return dsl;

    } catch (error) {
      performanceLogger.endTimer(timer);
      apiLogger.error('Failed to parse natural language to DSL', error as Error, {
        textLength: naturalLanguage.length,
        symbol,
        timeframe
      });
      throw error;
    }
  }

  /**
   * Validate DSL strategy structure and logic
   */
  async validateDSL(dsl: DSLStrategy): Promise<DSLValidationResult> {
    const errors: DSLValidationError[] = [];
    const warnings: DSLValidationWarning[] = [];
    const suggestions: DSLSuggestion[] = [];

    try {
      // Schema validation
      const schemaResult = dslStrategySchema.safeParse(dsl);
      if (!schemaResult.success) {
        schemaResult.error.errors.forEach(err => {
          errors.push({
            field: err.path.join('.'),
            code: 'SCHEMA_VALIDATION',
            message: err.message,
            severity: 'ERROR',
            suggestions: []
          });
        });
      }

      // Business logic validation
      await this.validateBusinessLogic(dsl, errors, warnings, suggestions);

      // Performance and complexity analysis
      const complexity = this.analyzeComplexity(dsl);
      const performance = this.estimatePerformance(dsl);

      const result: DSLValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
        estimatedComplexity: complexity,
        estimatedPerformance: performance
      };

      apiLogger.debug('DSL validation completed', {
        strategyName: dsl.strategy_name,
        isValid: result.isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
        complexity,
        performance
      });

      return result;

    } catch (error) {
      apiLogger.error('Error during DSL validation', error as Error, {
        strategyName: dsl.strategy_name
      });

      return {
        isValid: false,
        errors: [{
          field: 'general',
          code: 'VALIDATION_ERROR',
          message: `Validation failed: ${(error as Error).message}`,
          severity: 'ERROR'
        }],
        warnings: [],
        suggestions: [],
        estimatedComplexity: 'HIGH',
        estimatedPerformance: 'POOR'
      };
    }
  }

  /**
   * Convert DSL to executable trading code
   */
  async generateTradingCode(dsl: DSLStrategy): Promise<string> {
    const timer = performanceLogger.startTimer('dsl_generate_code');

    try {
      apiLogger.info('Generating trading code from DSL', {
        strategyName: dsl.strategy_name,
        symbol: dsl.symbol,
        timeframe: dsl.timeframe
      });

      const code = `
/**
 * Generated Trading Strategy: ${dsl.strategy_name}
 * Symbol: ${dsl.symbol}
 * Timeframe: ${dsl.timeframe}
 * Generated at: ${new Date().toISOString()}
 */

export class ${this.toPascalCase(dsl.strategy_name)} {
  constructor(config = {}) {
    this.config = {
      symbol: '${dsl.symbol}',
      timeframe: '${dsl.timeframe}',
      initialCash: ${dsl.params.initial_cash},
      fee: ${dsl.params.fee},
      slippage: ${dsl.params.slippage || 0.001},
      stopLoss: ${dsl.risk.stop_loss},
      takeProfit: ${dsl.risk.take_profit},
      ...config
    };

    this.indicators = {};
    this.position = 0;
    this.cash = this.config.initialCash;
    this.trades = [];
    this.equity = [];
    this.lastSignal = null;
  }

  /**
   * Initialize indicators
   */
  async initialize() {
    ${this.generateIndicatorInitialization(dsl.indicators)}
  }

  /**
   * Process new candle data
   */
  async onCandle(candle) {
    // Update indicators
    await this.updateIndicators(candle);

    // Check entry conditions
    const entrySignal = this.checkEntryConditions(candle);

    // Check exit conditions
    const exitSignal = this.checkExitConditions(candle);

    // Execute trades
    await this.executeTrades(entrySignal, exitSignal, candle);

    // Update equity tracking
    this.updateEquity(candle);

    return {
      signal: entrySignal || exitSignal,
      position: this.position,
      equity: this.getEquity(),
      indicators: this.getIndicatorValues()
    };
  }

  /**
   * Update technical indicators
   */
  async updateIndicators(candle) {
    ${this.generateIndicatorUpdates(dsl.indicators)}
  }

  /**
   * Check entry conditions
   */
  checkEntryConditions(candle) {
    if (this.position !== 0) return null;

    ${this.generateConditionChecks(dsl.entry, 'ENTRY')}
  }

  /**
   * Check exit conditions
   */
  checkExitConditions(candle) {
    if (this.position === 0) return null;

    ${this.generateConditionChecks(dsl.exit, 'EXIT')}
  }

  /**
   * Execute trading signals
   */
  async executeTrades(entrySignal, exitSignal, candle) {
    const currentPrice = candle.close;

    if (entrySignal && this.position === 0) {
      const quantity = this.calculatePositionSize(currentPrice);

      this.position = entrySignal.side === 'LONG' ? quantity : -quantity;
      this.cash -= Math.abs(quantity * currentPrice) * (1 + this.config.fee);

      this.trades.push({
        type: 'ENTRY',
        side: entrySignal.side,
        price: currentPrice,
        quantity: Math.abs(quantity),
        timestamp: candle.timestamp,
        reason: entrySignal.reason
      });
    }

    if (exitSignal && this.position !== 0) {
      const exitPrice = currentPrice;
      const quantity = Math.abs(this.position);
      const pnl = this.position > 0
        ? (exitPrice - this.getAverageEntryPrice()) * quantity
        : (this.getAverageEntryPrice() - exitPrice) * quantity;

      this.cash += quantity * exitPrice * (1 - this.config.fee);
      this.position = 0;

      this.trades.push({
        type: 'EXIT',
        price: exitPrice,
        quantity,
        pnl,
        timestamp: candle.timestamp,
        reason: exitSignal.reason
      });
    }
  }

  /**
   * Calculate position size
   */
  calculatePositionSize(price) {
    const riskAmount = this.getEquity() * this.config.stopLoss;
    const positionValue = this.cash * 0.95; // Use 95% of available cash
    return Math.floor(positionValue / price);
  }

  /**
   * Get current equity
   */
  getEquity() {
    return this.cash + (this.position * this.getLastPrice());
  }

  /**
   * Get indicator values
   */
  getIndicatorValues() {
    const values = {};
    for (const [key, indicator] of Object.entries(this.indicators)) {
      values[key] = indicator.getValue();
    }
    return values;
  }

  /**
   * Get performance statistics
   */
  getPerformance() {
    const totalTrades = this.trades.filter(t => t.type === 'EXIT').length;
    const winningTrades = this.trades.filter(t => t.type === 'EXIT' && t.pnl > 0).length;
    const totalReturn = (this.getEquity() - this.config.initialCash) / this.config.initialCash;

    return {
      totalReturn,
      totalTrades,
      winRate: totalTrades > 0 ? winningTrades / totalTrades : 0,
      profitFactor: this.calculateProfitFactor(),
      maxDrawdown: this.calculateMaxDrawdown(),
      sharpeRatio: this.calculateSharpeRatio()
    };
  }

  // Helper methods
  ${this.generateHelperMethods(dsl)}
}
`;

      performanceLogger.endTimer(timer);

      apiLogger.info('Successfully generated trading code', {
        strategyName: dsl.strategy_name,
        codeLength: code.length,
        indicatorCount: dsl.indicators.length
      });

      return code;

    } catch (error) {
      performanceLogger.endTimer(timer);
      apiLogger.error('Failed to generate trading code', error as Error, {
        strategyName: dsl.strategy_name
      });
      throw error;
    }
  }

  /**
   * Extract strategy components from natural language using AI
   */
  private async extractStrategyComponents(text: string) {
    try {
      // Use OpenRouter AI for intelligent strategy component extraction
      const extractionPrompt = `
        Extract trading strategy components from this natural language description:
        "${text}"

        Available indicators: SMA, EMA, RSI, MACD, BB (Bollinger Bands), STOCH, ATR, ADX, OBV, VWAP, WR, CCI, MFI, KDJ, DMI, SAR, ICHIMOKU, VOLUME

        Extract and format as JSON:
        {
          "name": "strategy name or generate one",
          "indicators": [
            {"name": "INDICATOR", "alias": "indicator_period", "params": {"period": number}}
          ],
          "entry": [
            {"left": "indicator_alias_or_price", "op": "comparison", "right": "value_or_indicator"}
          ],
          "exit": [
            {"left": "indicator_alias_or_price", "op": "comparison", "right": "value_or_indicator"}
          ],
          "risk": {
            "stop_loss": decimal_percentage,
            "take_profit": decimal_percentage,
            "position_size": decimal_percentage
          },
          "params": {
            "initial_cash": number,
            "fee": decimal_percentage
          }
        }

        Rules:
        - Use standard indicator periods (RSI: 14, SMA/EMA: 20, MACD: 12,26,9)
        - Convert percentages to decimals (5% = 0.05)
        - Generate meaningful alias names (rsi_14, sma_20, etc.)
        - Use operators: <, >, <=, >=, ==, !=
        - Default stop_loss: 0.02 (2%), take_profit: 0.04 (4%)
      `;

      const response = await this.openRouterService.processConversation(
        [{ role: 'user', content: extractionPrompt }],
        {
          model: 'claude-3.5-sonnet',
          maxTokens: 1000,
          temperature: 0.2
        }
      );

      if (response.success && response.data?.choices?.[0]?.message?.content) {
        try {
          const aiComponents = JSON.parse(response.data.choices[0].message.content);

          // Validate and sanitize AI response
          const components = {
            name: aiComponents.name || 'AI Generated Strategy',
            indicators: this.sanitizeIndicators(aiComponents.indicators || []),
            entry: this.sanitizeConditions(aiComponents.entry || []),
            exit: this.sanitizeConditions(aiComponents.exit || []),
            risk: this.sanitizeRisk(aiComponents.risk || {}),
            params: this.sanitizeParams(aiComponents.params || {})
          };

          apiLogger.info('AI strategy extraction successful', {
            textLength: text.length,
            indicatorCount: components.indicators.length,
            entryConditions: components.entry.length,
            exitConditions: components.exit.length
          });

          return components;

        } catch (parseError) {
          apiLogger.warn('Failed to parse AI strategy extraction', {
            response: response.data.choices[0].message.content.substring(0, 200),
            error: parseError
          });
          return this.fallbackExtraction(text);
        }
      }

      // Fallback to pattern-based extraction
      return this.fallbackExtraction(text);

    } catch (error) {
      apiLogger.warn('AI strategy extraction failed, using fallback', error as Error);
      return this.fallbackExtraction(text);
    }
  }

  /**
   * Fallback extraction using pattern matching
   */
  private fallbackExtraction(text: string) {
    const components = {
      name: this.extractStrategyName(text),
      indicators: this.extractIndicators(text),
      entry: this.extractEntryConditions(text),
      exit: this.extractExitConditions(text),
      risk: this.extractRiskManagement(text),
      params: this.extractParameters(text)
    };

    // Apply defaults if not found
    if (components.indicators.length === 0) {
      components.indicators = [
        { name: 'SMA', alias: 'sma_20', params: { period: 20 } },
        { name: 'RSI', alias: 'rsi_14', params: { period: 14 } }
      ];
    }

    if (components.entry.length === 0) {
      components.entry = [
        { left: 'rsi_14', op: '<', right: 30 }
      ];
    }

    if (components.exit.length === 0) {
      components.exit = [
        { left: 'rsi_14', op: '>', right: 70 }
      ];
    }

    return components;
  }

  /**
   * Sanitize AI-generated indicators
   */
  private sanitizeIndicators(indicators: any[]): DSLIndicator[] {
    return indicators
      .filter(ind => ind.name && supportedIndicators.includes(ind.name))
      .map(ind => ({
        name: ind.name,
        alias: ind.alias || `${ind.name.toLowerCase()}_${ind.params?.period || 14}`,
        params: { ...this.indicatorDefaults[ind.name], ...ind.params }
      }));
  }

  /**
   * Sanitize AI-generated conditions
   */
  private sanitizeConditions(conditions: any[]): DSLCondition[] {
    const validOperators = ['<', '>', '<=', '>=', '==', '!='];
    return conditions
      .filter(cond =>
        cond.left &&
        cond.op &&
        validOperators.includes(cond.op) &&
        (cond.right !== undefined && cond.right !== null)
      )
      .map(cond => ({
        left: cond.left,
        op: cond.op,
        right: cond.right
      }));
  }

  /**
   * Sanitize AI-generated risk parameters
   */
  private sanitizeRisk(risk: any) {
    return {
      stop_loss: typeof risk.stop_loss === 'number' ? Math.max(0.005, Math.min(0.1, risk.stop_loss)) : 0.02,
      take_profit: typeof risk.take_profit === 'number' ? Math.max(0.01, Math.min(0.2, risk.take_profit)) : 0.04,
      position_size: typeof risk.position_size === 'number' ? Math.max(0.1, Math.min(1.0, risk.position_size)) : 1.0
    };
  }

  /**
   * Sanitize AI-generated parameters
   */
  private sanitizeParams(params: any) {
    return {
      initial_cash: typeof params.initial_cash === 'number' ? Math.max(1000, params.initial_cash) : 10000,
      fee: typeof params.fee === 'number' ? Math.max(0, Math.min(0.01, params.fee)) : 0.001
    };
  }

  private extractStrategyName(text: string): string {
    const patterns = [
      /(?:strategy|algorithm|system)\s+(?:called|named)\s+["']([^"']+)["']/i,
      /["']([^"']+)["']\s+strategy/i,
      /create\s+(?:a\s+)?strategy\s+["']([^"']+)["']/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }

    return 'Custom Strategy';
  }

  private extractIndicators(text: string): DSLIndicator[] {
    const indicators: DSLIndicator[] = [];
    const lowerText = text.toLowerCase();

    // RSI detection
    if (lowerText.includes('rsi') || lowerText.includes('relative strength')) {
      const period = this.extractNumber(text, /rsi[^\d]*(\d+)/i) || 14;
      indicators.push({
        name: 'RSI',
        alias: `rsi_${period}`,
        params: { period }
      });
    }

    // SMA detection
    if (lowerText.includes('sma') || lowerText.includes('simple moving average')) {
      const period = this.extractNumber(text, /sma[^\d]*(\d+)/i) || 20;
      indicators.push({
        name: 'SMA',
        alias: `sma_${period}`,
        params: { period }
      });
    }

    // EMA detection
    if (lowerText.includes('ema') || lowerText.includes('exponential moving average')) {
      const period = this.extractNumber(text, /ema[^\d]*(\d+)/i) || 20;
      indicators.push({
        name: 'EMA',
        alias: `ema_${period}`,
        params: { period }
      });
    }

    // MACD detection
    if (lowerText.includes('macd')) {
      indicators.push({
        name: 'MACD',
        alias: 'macd',
        params: { fast: 12, slow: 26, signal: 9 }
      });
    }

    // Bollinger Bands detection
    if (lowerText.includes('bollinger') || lowerText.includes(' bb ')) {
      indicators.push({
        name: 'BB',
        alias: 'bb',
        params: { period: 20, multiplier: 2 }
      });
    }

    return indicators;
  }

  private extractEntryConditions(text: string): DSLCondition[] {
    const conditions: DSLCondition[] = [];
    const lowerText = text.toLowerCase();

    // RSI oversold condition
    if (lowerText.includes('rsi') && (lowerText.includes('below') || lowerText.includes('under'))) {
      const threshold = this.extractNumber(text, /below[^\d]*(\d+)/i) || 30;
      conditions.push({
        left: 'rsi_14',
        op: '<',
        right: threshold
      });
    }

    // Price above moving average
    if (lowerText.includes('price') && lowerText.includes('above') && (lowerText.includes('sma') || lowerText.includes('ema'))) {
      conditions.push({
        left: 'close',
        op: '>',
        right: 'sma_20'
      });
    }

    return conditions;
  }

  private extractExitConditions(text: string): DSLCondition[] {
    const conditions: DSLCondition[] = [];
    const lowerText = text.toLowerCase();

    // RSI overbought condition
    if (lowerText.includes('rsi') && (lowerText.includes('above') || lowerText.includes('over'))) {
      const threshold = this.extractNumber(text, /above[^\d]*(\d+)/i) || 70;
      conditions.push({
        left: 'rsi_14',
        op: '>',
        right: threshold
      });
    }

    return conditions;
  }

  private extractRiskManagement(text: string) {
    let stopLoss = this.extractNumber(text, /stop[^\d]*loss[^\d]*(\d+(?:\.\d+)?)/i) || 2;
    let takeProfit = this.extractNumber(text, /take[^\d]*profit[^\d]*(\d+(?:\.\d+)?)/i) || 4;

    // Convert percentages to decimals if they appear to be percentages
    if (stopLoss > 1) {
      stopLoss = stopLoss / 100;
    }
    if (takeProfit > 1) {
      takeProfit = takeProfit / 100;
    }

    return {
      stop_loss: stopLoss,
      take_profit: takeProfit
    };
  }

  private extractParameters(text: string) {
    const initialCash = this.extractNumber(text, /initial[^\d]*capital[^\d]*(\d+)/i) || 10000;
    const fee = this.extractNumber(text, /fee[^\d]*(\d+(?:\.\d+)?)/i) || 0.001;

    return {
      initial_cash: initialCash,
      fee,
      slippage: 0.001,
      commission: 0
    };
  }

  private extractNumber(text: string, pattern: RegExp): number | null {
    const match = text.match(pattern);
    return match ? parseFloat(match[1]) : null;
  }

  private async validateBusinessLogic(
    dsl: DSLStrategy,
    errors: DSLValidationError[],
    warnings: DSLValidationWarning[],
    suggestions: DSLSuggestion[]
  ) {
    // Validate indicators
    for (const indicator of dsl.indicators) {
      if (!supportedIndicators.includes(indicator.name as any)) {
        errors.push({
          field: 'indicators',
          code: 'UNSUPPORTED_INDICATOR',
          message: `Unsupported indicator: ${indicator.name}`,
          severity: 'ERROR',
          suggestions: [`Use one of: ${supportedIndicators.join(', ')}`]
        });
      }
    }

    // Validate symbol
    if (!this.supportedSymbols.has(dsl.symbol)) {
      warnings.push({
        field: 'symbol',
        code: 'UNSUPPORTED_SYMBOL',
        message: `Symbol ${dsl.symbol} may not be supported`,
        impact: 'MEDIUM'
      });
    }

    // Validate timeframe
    if (!this.supportedTimeframes.includes(dsl.timeframe)) {
      errors.push({
        field: 'timeframe',
        code: 'INVALID_TIMEFRAME',
        message: `Invalid timeframe: ${dsl.timeframe}`,
        severity: 'ERROR',
        suggestions: [`Use one of: ${this.supportedTimeframes.join(', ')}`]
      });
    }

    // Risk management validation
    if (dsl.risk.stop_loss > 0.1) {
      warnings.push({
        field: 'risk.stop_loss',
        code: 'HIGH_STOP_LOSS',
        message: 'Stop loss above 10% is considered high risk',
        impact: 'HIGH'
      });
    }

    if (dsl.risk.take_profit < dsl.risk.stop_loss) {
      suggestions.push({
        type: 'BEST_PRACTICE',
        message: 'Take profit should generally be higher than stop loss for better risk-reward ratio',
        field: 'risk'
      });
    }
  }

  private analyzeComplexity(dsl: DSLStrategy): 'LOW' | 'MEDIUM' | 'HIGH' {
    let complexity = 0;

    complexity += dsl.indicators.length;
    complexity += dsl.entry.length;
    complexity += dsl.exit.length;

    if (complexity <= 5) return 'LOW';
    if (complexity <= 10) return 'MEDIUM';
    return 'HIGH';
  }

  private estimatePerformance(dsl: DSLStrategy): 'POOR' | 'AVERAGE' | 'GOOD' | 'EXCELLENT' {
    // Simple heuristic-based performance estimation
    // In a real implementation, this would use ML models or historical data

    let score = 0;

    // Diversified indicators are generally better
    if (dsl.indicators.length >= 2 && dsl.indicators.length <= 4) score += 2;

    // Reasonable risk management
    if (dsl.risk.stop_loss > 0 && dsl.risk.stop_loss < 0.05) score += 2;
    if (dsl.risk.take_profit > dsl.risk.stop_loss * 1.5) score += 1;

    // Multiple conditions can be good but not too many
    if (dsl.entry.length >= 1 && dsl.entry.length <= 3) score += 1;
    if (dsl.exit.length >= 1 && dsl.exit.length <= 3) score += 1;

    if (score >= 6) return 'EXCELLENT';
    if (score >= 4) return 'GOOD';
    if (score >= 2) return 'AVERAGE';
    return 'POOR';
  }

  private toPascalCase(str: string): string {
    return str.replace(/(?:^|\s+)([a-z])/g, (_, char) => char.toUpperCase())
              .replace(/[^a-zA-Z0-9]/g, '');
  }

  private generateIndicatorInitialization(indicators: DSLIndicator[]): string {
    return indicators.map(ind => {
      const params = { ...this.indicatorDefaults[ind.name], ...ind.params };
      const paramStr = Object.entries(params)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join(', ');

      return `    this.indicators.${ind.alias} = new ${ind.name}Indicator({ ${paramStr} });`;
    }).join('\n');
  }

  private generateIndicatorUpdates(indicators: DSLIndicator[]): string {
    return indicators.map(ind =>
      `    this.indicators.${ind.alias}.update(candle);`
    ).join('\n');
  }

  private generateConditionChecks(conditions: DSLCondition[], type: 'ENTRY' | 'EXIT'): string {
    if (conditions.length === 0) return '    return null;';

    const checks = conditions.map((condition, index) => {
      const left = this.resolveOperand(condition.left);
      const right = this.resolveOperand(condition.right);
      const operator = this.mapOperator(condition.op);

      return `const condition${index} = ${left} ${operator} ${right};`;
    }).join('\n    ');

    const conditionList = conditions.map((_, index) => `condition${index}`).join(' && ');

    return `
    ${checks}

    if (${conditionList}) {
      return {
        type: '${type}',
        side: '${type === 'ENTRY' ? 'LONG' : 'EXIT'}',
        strength: 1.0,
        reason: '${type.toLowerCase()}_conditions_met'
      };
    }

    return null;`;
  }

  private generateHelperMethods(dsl: DSLStrategy): string {
    return `
  getLastPrice() {
    // Implementation would get the last price from the current candle
    return this.lastCandle?.close || 0;
  }

  getAverageEntryPrice() {
    // Calculate average entry price from trades
    const entryTrades = this.trades.filter(t => t.type === 'ENTRY');
    if (entryTrades.length === 0) return 0;

    const totalValue = entryTrades.reduce((sum, trade) => sum + (trade.price * trade.quantity), 0);
    const totalQuantity = entryTrades.reduce((sum, trade) => sum + trade.quantity, 0);

    return totalQuantity > 0 ? totalValue / totalQuantity : 0;
  }

  calculateProfitFactor() {
    const exitTrades = this.trades.filter(t => t.type === 'EXIT');
    const profits = exitTrades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const losses = Math.abs(exitTrades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));

    return losses > 0 ? profits / losses : profits > 0 ? Number.POSITIVE_INFINITY : 0;
  }

  calculateMaxDrawdown() {
    if (this.equity.length < 2) return 0;

    let maxDrawdown = 0;
    let peak = this.equity[0].value;

    for (const point of this.equity) {
      if (point.value > peak) peak = point.value;
      const drawdown = (peak - point.value) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return maxDrawdown;
  }

  calculateSharpeRatio() {
    // Simplified Sharpe ratio calculation
    const returns = this.equity.map((point, index) =>
      index === 0 ? 0 : (point.value - this.equity[index - 1].value) / this.equity[index - 1].value
    ).slice(1);

    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  updateEquity(candle) {
    this.lastCandle = candle;
    this.equity.push({
      timestamp: candle.timestamp,
      value: this.getEquity(),
      position: this.position,
      cash: this.cash
    });
  }`;
  }

  private resolveOperand(operand: string | number): string {
    if (typeof operand === 'number') return operand.toString();

    // Check if it's a price field
    if (['open', 'high', 'low', 'close', 'volume'].includes(operand)) {
      return `candle.${operand}`;
    }

    // Check if it's an indicator
    return `this.indicators.${operand}.getValue()`;
  }

  private mapOperator(op: string): string {
    const mapping: Record<string, string> = {
      '>': '>',
      '<': '<',
      '>=': '>=',
      '<=': '<=',
      '==': '===',
      '!=': '!==',
      'crosses_above': '>', // Simplified for now
      'crosses_below': '<',
      'touches': '>=',
      'breaks_above': '>',
      'breaks_below': '<'
    };

    return mapping[op] || '===';
  }
}

// Singleton instance
let dslProcessorInstance: DSLProcessor | null = null;

export function getDSLProcessor(): DSLProcessor {
  if (!dslProcessorInstance) {
    dslProcessorInstance = new DSLProcessor();
  }
  return dslProcessorInstance;
}

export const dslProcessor = getDSLProcessor();