// config/constants.js

export const CACHE_CONFIG = {
  DASHBOARD_CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  ANALYTICS_CACHE_DURATION: 10 * 60 * 1000, // 10 minutes
  MAX_CACHE_ENTRIES: 1000
};

export const BATCH_CONFIG = {
  DEFAULT_BATCH_SIZE: 1000,
  MAX_BATCH_SIZE: 5000,
  CONVERSATION_BATCH_SIZE: 2000,
  TOKEN_BATCH_SIZE: 1000
};

export const MODEL_PRICING = {
  'gpt-4o-realtime-preview': {
    input: 0.032,  // per 1K audio tokens
    output: 0.064
  },
  'gpt-4o-realtime-preview-2025-06-03': {
    input: 0.032,
    output: 0.064
  },
  'gpt-4o-realtime-preview-2024-12-17': {
    input: 0.032,
    output: 0.064
  },
  'gpt-4o-realtime-preview-2024-10-01': {
    input: 0.032,
    output: 0.064
  },
  'gpt-4o-mini-realtime-preview': {
    input: 0.010,
    output: 0.020
  },
  'gpt-4o-mini-realtime-preview-2024-12-17': {
    input: 0.010,
    output: 0.020
  },
  'gpt-4': {
    input: 0.03,   // per 1K tokens
    output: 0.06
  },
  'gpt-4-turbo': {
    input: 0.01,
    output: 0.03
  },
  'gpt-4o': {
    input: 0.005,
    output: 0.015
  },
  'gpt-4o-mini': {
    input: 0.00015,
    output: 0.0006
  },
  'gpt-3.5-turbo': {
    input: 0.001,
    output: 0.002
  },
  'text-embedding-3-small': {
    input: 0.00002,
    output: 0
  },
  'text-embedding-3-large': {
    input: 0.00013,
    output: 0
  },
  'claude-3-opus': {
    input: 0.015,
    output: 0.075
  },
  'claude-3-sonnet': {
    input: 0.003,
    output: 0.015
  },
  'claude-3-haiku': {
    input: 0.00025,
    output: 0.00125
  }
};

export const BUSINESS_LIMITS = {
  MAX_DAYS_RETENTION: 365,
  MIN_DAYS_RETENTION: 1,
  DEFAULT_DAYS_RETENTION: 45,
  MAX_AGENTS_PER_BUSINESS: 100,
  MAX_FACTS_COUNT: 50,
  MAX_QUICK_QUESTIONS: 20
};

export const VALIDATION_RULES = {
  BUSINESS_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 200
  },
  TAGLINE: {
    MAX_LENGTH: 200
  },
  DESCRIPTION: {
    MAX_LENGTH: 2000
  },
  FACT: {
    MAX_LENGTH: 1000
  },
  ADDRESS: {
    MAX_LENGTH: 500
  },
  QUICK_QUESTION_LABEL: {
    MAX_LENGTH: 200
  },
  QUICK_QUESTION_VALUE: {
    MAX_LENGTH: 500
  }
};

export const CHANNEL_TYPES = [
  'email',
  'whatsapp',
  'telegram',
  'web',
  'phone',
  'sms',
  'instagram'
];

export const ANALYTICS_TYPES = {
  CHAT: 'chat',
  ANALYSIS: 'analysis',
  KNOWLEDGE: 'knowledge',
  EMBEDDING: 'embedding',
  SUMMARIZATION: 'summarization'
};

export const ERROR_MESSAGES = {
  BUSINESS_NOT_FOUND: 'Business not found',
  INVALID_BUSINESS_ID: 'Invalid business ID',
  ANALYTICS_UPDATE_FAILED: 'Failed to update analytics',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  INVALID_DATE_RANGE: 'Invalid date range',
  CALCULATION_ERROR: 'Cost calculation error'
};

export const SUCCESS_MESSAGES = {
  DASHBOARD_RETRIEVED: 'Dashboard retrieved successfully',
  DASHBOARD_UPDATED: 'Dashboard updated successfully',
  ANALYTICS_RESET: 'Analytics reset successfully',
  CACHE_HIT: 'Dashboard retrieved from cache'
};

export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

// Database query optimization settings
export const DB_CONFIG = {
  CONNECTION_POOL_SIZE: 10,
  MAX_QUERY_TIME: 30000, // 30 seconds
  BATCH_WRITE_SIZE: 100,
  INDEX_HINT_THRESHOLD: 1000
};

// Performance monitoring thresholds
export const PERFORMANCE_THRESHOLDS = {
  SLOW_QUERY_MS: 1000,
  MEMORY_WARNING_MB: 512,
  CPU_WARNING_PERCENT: 80,
  MAX_CONCURRENT_UPDATES: 10
};

// Feature flags for gradual rollout
export const FEATURE_FLAGS = {
  ENABLE_ADVANCED_ANALYTICS: true,
  ENABLE_REAL_TIME_UPDATES: false,
  ENABLE_COST_OPTIMIZATION: true,
  ENABLE_PERFORMANCE_MONITORING: true,
  ENABLE_BATCH_PROCESSING: true
};

// Export utility function to get model pricing
export const getModelPricing = (modelName) => {
  return MODEL_PRICING[modelName] || { input: 0, output: 0 };
};

// Export utility function to validate retention days
export const validateRetentionDays = (days) => {
  return Math.min(
    Math.max(days || BUSINESS_LIMITS.DEFAULT_DAYS_RETENTION, BUSINESS_LIMITS.MIN_DAYS_RETENTION),
    BUSINESS_LIMITS.MAX_DAYS_RETENTION
  );
};

// Export utility function for batch size calculation
export const calculateOptimalBatchSize = (totalRecords, memoryConstraint = 100) => {
  const maxBatch = Math.floor(memoryConstraint * 1024 * 1024 / 1000); // Rough estimation
  return Math.min(
    Math.max(Math.floor(totalRecords / 10), BATCH_CONFIG.DEFAULT_BATCH_SIZE),
    Math.min(maxBatch, BATCH_CONFIG.MAX_BATCH_SIZE)
  );
};