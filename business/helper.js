// utils/helpers.js

import {
    MODEL_PRICING,
    PERFORMANCE_THRESHOLDS,
    LOG_LEVELS,
    ERROR_MESSAGES
} from '../config/constants.js';

/**
 * Enhanced cost calculation with better error handling and validation
 */
export const calculateCost = (modelName, inputTokens = 0, outputTokens = 0) => {
    try {
        // Input validation
        if (!modelName || typeof modelName !== 'string') {
            throw new Error('Invalid model name');
        }

        const input = Math.max(0, Number(inputTokens) || 0);
        const output = Math.max(0, Number(outputTokens) || 0);

        const pricing = MODEL_PRICING[modelName];
        if (!pricing) {
            console.warn(`Unknown model pricing for: ${modelName}. Using zero cost.`);
            return {
                inputCost: 0,
                outputCost: 0,
                totalCost: 0,
                model: modelName,
                inputTokens: input,
                outputTokens: output,
                warning: 'Unknown model pricing'
            };
        }

        // Calculate costs (pricing is per 1K tokens)
        const inputCost = (input / 1000) * pricing.input;
        const outputCost = (output / 1000) * pricing.output;
        const totalCost = inputCost + outputCost;

        return {
            inputCost: Number(inputCost.toFixed(6)),
            outputCost: Number(outputCost.toFixed(6)),
            totalCost: Number(totalCost.toFixed(6)),
            model: modelName,
            inputTokens: input,
            outputTokens: output
        };

    } catch (error) {
        console.error('Cost calculation error:', error.message);
        return {
            inputCost: 0,
            outputCost: 0,
            totalCost: 0,
            model: modelName,
            inputTokens: 0,
            outputTokens: 0,
            error: error.message
        };
    }
};

/**
 * Performance monitoring utility class
 */
export class PerformanceMonitor {
    constructor(operationName) {
        this.operationName = operationName;
        this.startTime = Date.now();
        this.startMemory = process.memoryUsage();
        this.checkpoints = [];
    }

    checkpoint(name) {
        const now = Date.now();
        const memory = process.memoryUsage();

        this.checkpoints.push({
            name,
            timestamp: now,
            duration: now - this.startTime,
            memoryUsage: {
                rss: memory.rss,
                heapUsed: memory.heapUsed,
                heapTotal: memory.heapTotal,
                external: memory.external
            }
        });
    }

    finish() {
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        const totalDuration = endTime - this.startTime;

        const report = {
            operation: this.operationName,
            totalDuration,
            memoryDelta: {
                rss: endMemory.rss - this.startMemory.rss,
                heapUsed: endMemory.heapUsed - this.startMemory.heapUsed,
                heapTotal: endMemory.heapTotal - this.startMemory.heapTotal
            },
            checkpoints: this.checkpoints,
            warnings: this._generateWarnings(totalDuration, endMemory)
        };

        // Log performance warnings
        if (report.warnings.length > 0) {
            console.warn(`Performance warnings for ${this.operationName}:`, report.warnings);
        }

        return report;
    }

    _generateWarnings(duration, memory) {
        const warnings = [];

        if (duration > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS) {
            warnings.push(`Slow operation: ${duration}ms (threshold: ${PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS}ms)`);
        }

        const memoryMB = memory.heapUsed / (1024 * 1024);
        if (memoryMB > PERFORMANCE_THRESHOLDS.MEMORY_WARNING_MB) {
            warnings.push(`High memory usage: ${memoryMB.toFixed(2)}MB (threshold: ${PERFORMANCE_THRESHOLDS.MEMORY_WARNING_MB}MB)`);
        }

        return warnings;
    }
}

/**
 * Enhanced logger with structured logging
 */
export class Logger {
    constructor(service = 'dashboard') {
        this.service = service;
    }

    _formatMessage(level, message, meta = {}) {
        return {
            timestamp: new Date().toISOString(),
            service: this.service,
            level,
            message,
            ...meta
        };
    }

    info(message, meta = {}) {
        if (process.env.NODE_ENV !== 'test') {
            console.log(JSON.stringify(this._formatMessage(LOG_LEVELS.INFO, message, meta)));
        }
    }

    warn(message, meta = {}) {
        console.warn(JSON.stringify(this._formatMessage(LOG_LEVELS.WARN, message, meta)));
    }

    error(message, meta = {}) {
        console.error(JSON.stringify(this._formatMessage(LOG_LEVELS.ERROR, message, meta)));
    }

    debug(message, meta = {}) {
        if (process.env.NODE_ENV === 'development') {
            console.log(JSON.stringify(this._formatMessage(LOG_LEVELS.DEBUG, message, meta)));
        }
    }
}

/**
 * Rate limiter for preventing concurrent operations
 */
export class RateLimiter {
    constructor(maxConcurrent = 10, windowMs = 60000) {
        this.maxConcurrent = maxConcurrent;
        this.windowMs = windowMs;
        this.activeOperations = new Map();
        this.operationCounts = new Map();
    }

    async acquire(key) {
        const now = Date.now();

        // Clean up old entries
        this._cleanup(now);

        // Check if we're at the limit
        const currentCount = this.operationCounts.get(key) || 0;
        if (currentCount >= this.maxConcurrent) {
            throw new Error(`Rate limit exceeded for ${key}. Max: ${this.maxConcurrent}`);
        }

        // Increment counter
        this.operationCounts.set(key, currentCount + 1);
        this.activeOperations.set(`${key}_${now}`, now);

        return () => this.release(key, now);
    }

    release(key, timestamp) {
        const operationKey = `${key}_${timestamp}`;
        if (this.activeOperations.has(operationKey)) {
            this.activeOperations.delete(operationKey);
            const currentCount = this.operationCounts.get(key) || 0;
            this.operationCounts.set(key, Math.max(0, currentCount - 1));
        }
    }

    _cleanup(now) {
        const cutoff = now - this.windowMs;

        for (const [operationKey, timestamp] of this.activeOperations.entries()) {
            if (timestamp < cutoff) {
                const key = operationKey.split('_')[0];
                this.release(key, timestamp);
            }
        }
    }
}

/**
 * Data validation utilities
 */
export const validateBusinessData = (data) => {
    const errors = [];

    if (!data.name || data.name.trim().length === 0) {
        errors.push('Business name is required');
    }

    if (data.name && data.name.length > 200) {
        errors.push('Business name must be less than 200 characters');
    }

    if (data.tagline && data.tagline.length > 200) {
        errors.push('Tagline must be less than 200 characters');
    }

    if (data.description && data.description.length > 2000) {
        errors.push('Description must be less than 2000 characters');
    }

    if (data.contact?.mail && !isValidEmail(data.contact.mail)) {
        errors.push('Invalid email format');
    }

    if (data.contact?.website && !isValidUrl(data.contact.website)) {
        errors.push('Invalid website URL');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Date utilities
 */
export const getDateRange = (days = 30) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    return { start, end };
};

export const formatDateForDb = (date) => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
};

/**
 * Memory-efficient data processing
 */
export const processBatchData = async (data, batchSize, processFn) => {
    const results = [];

    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const batchResult = await processFn(batch);
        results.push(...batchResult);

        // Allow garbage collection between batches
        if (global.gc && i % (batchSize * 10) === 0) {
            global.gc();
        }
    }

    return results;
};

/**
 * Error wrapper for consistent error handling
 */
export const errorWrapper = (fn) => {
    return async (req, res, next) => {
        try {
            const result = await fn(req, res, next);

            // If the function returns a result object, send it as response
            if (result && typeof result === 'object' && result.statusCode) {
                return res.status(result.statusCode).json({
                    success: result.statusCode >= 200 && result.statusCode < 300,
                    message: result.message,
                    data: result.data,
                    metadata: result.metadata
                });
            }

            return result;
        } catch (error) {
            console.error('Controller error:', error);

            // Send appropriate error response
            const statusCode = error.statusCode || 500;
            const message = error.message || ERROR_MESSAGES.ANALYTICS_UPDATE_FAILED;

            res.status(statusCode).json({
                success: false,
                message,
                data: null,
                error: process.env.NODE_ENV === 'development' ? {
                    stack: error.stack,
                    details: error.details
                } : undefined
            });
        }
    };
};

// Helper validation functions
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const isValidUrl = (url) => {
    try {
        new URL(url);
        return url.startsWith('http://') || url.startsWith('https://');
    } catch {
        return false;
    }
};

// Export singleton instances
export const logger = new Logger('dashboard-service');
export const rateLimiter = new RateLimiter(10, 60000);