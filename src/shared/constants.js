/**
 * 共享常量定义
 */

// 应用常量
const APP_CONSTANTS = {
    NAME: 'P_Excel桌面版',
    VERSION: '1.0.0',
    DESCRIPTION: '基于Electron的大文件Excel/CSV批量处理工具'
};

// 文件处理常量
const FILE_CONSTANTS = {
    // 支持的文件格式
    SUPPORTED_EXTENSIONS: ['.xlsx', '.xls', '.csv'],
    
    // 文件大小限制
    MAX_FILE_SIZE: 10 * 1024 * 1024 * 1024, // 10GB
    MIN_FILE_SIZE: 1, // 1 byte
    
    // 数据处理限制
    MAX_ROWS: 10000000, // 1000万行
    MAX_COLUMNS: 1000,
    DEFAULT_CHUNK_SIZE: 100000, // 10万行
    
    // 文件类型
    FILE_TYPES: {
        EXCEL: 'excel',
        CSV: 'csv'
    }
};

// 缓存常量
const CACHE_CONSTANTS = {
    // 缓存大小限制
    MAX_CACHE_SIZE: 2 * 1024 * 1024 * 1024, // 2GB
    DEFAULT_TTL: 24 * 60 * 60 * 1000, // 24小时
    
    // 缓存类型
    CACHE_TYPES: {
        DATA: 'data',
        TEMP: 'temp',
        CONFIG: 'config'
    }
};

// 性能常量
const PERFORMANCE_CONSTANTS = {
    // 内存限制
    DEFAULT_MEMORY_LIMIT: 4 * 1024 * 1024 * 1024, // 4GB
    MEMORY_WARNING_THRESHOLD: 0.8, // 80%
    MEMORY_CRITICAL_THRESHOLD: 0.9, // 90%
    
    // CPU限制
    CPU_WARNING_THRESHOLD: 0.8, // 80%
    CPU_CRITICAL_THRESHOLD: 0.9, // 90%
    
    // 监控频率
    MONITOR_FREQUENCY: 5000, // 5秒
    
    // Worker线程
    DEFAULT_WORKER_THREADS: require('os').cpus().length,
    MAX_WORKER_THREADS: 16,
    MIN_WORKER_THREADS: 1
};

// UI常量
const UI_CONSTANTS = {
    // 主题
    THEMES: {
        LIGHT: 'light',
        DARK: 'dark',
        AUTO: 'auto'
    },
    
    // 语言
    LANGUAGES: {
        ZH_CN: 'zh-CN',
        EN_US: 'en-US'
    },
    
    // 预览设置
    DEFAULT_PREVIEW_ROWS: 1000,
    MAX_PREVIEW_ROWS: 10000,
    MIN_PREVIEW_ROWS: 10
};

// 错误代码
const ERROR_CODES = {
    // 文件错误
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    FILE_FORMAT_UNSUPPORTED: 'FILE_FORMAT_UNSUPPORTED',
    FILE_CORRUPTED: 'FILE_CORRUPTED',
    FILE_ACCESS_DENIED: 'FILE_ACCESS_DENIED',
    
    // 内存错误
    MEMORY_EXHAUSTED: 'MEMORY_EXHAUSTED',
    MEMORY_ALLOCATION_FAILED: 'MEMORY_ALLOCATION_FAILED',
    
    // 处理错误
    PROCESSING_FAILED: 'PROCESSING_FAILED',
    PROCESSING_TIMEOUT: 'PROCESSING_TIMEOUT',
    PROCESSING_CANCELLED: 'PROCESSING_CANCELLED',
    
    // 系统错误
    SYSTEM_ERROR: 'SYSTEM_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    
    // 配置错误
    CONFIG_INVALID: 'CONFIG_INVALID',
    CONFIG_MISSING: 'CONFIG_MISSING'
};

// 事件名称
const EVENT_NAMES = {
    // 文件事件
    FILE_UPLOADED: 'file:uploaded',
    FILE_PROCESSED: 'file:processed',
    FILE_EXPORTED: 'file:exported',
    FILE_ERROR: 'file:error',
    
    // 进度事件
    PROGRESS_UPDATE: 'progress:update',
    PROGRESS_COMPLETE: 'progress:complete',
    PROGRESS_ERROR: 'progress:error',
    
    // 系统事件
    SYSTEM_READY: 'system:ready',
    SYSTEM_ERROR: 'system:error',
    SYSTEM_WARNING: 'system:warning',
    
    // 资源事件
    MEMORY_WARNING: 'memory:warning',
    MEMORY_CRITICAL: 'memory:critical',
    CPU_WARNING: 'cpu:warning',
    CPU_CRITICAL: 'cpu:critical',
    
    // 缓存事件
    CACHE_HIT: 'cache:hit',
    CACHE_MISS: 'cache:miss',
    CACHE_CLEARED: 'cache:cleared'
};

// 默认配置
const DEFAULT_CONFIG = {
    performance: {
        maxMemoryUsage: '4GB',
        maxCacheSize: '2GB',
        workerThreads: require('os').cpus().length,
        chunkSize: 100000,
        enableCompression: true
    },
    ui: {
        theme: 'light',
        language: 'zh-CN',
        previewRows: 1000,
        enableAnimations: true
    },
    security: {
        enableEncryption: false,
        autoCleanup: true,
        maxFileSize: '10GB'
    },
    advanced: {
        enableLogging: true,
        logLevel: 'info',
        enableTelemetry: false,
        autoUpdate: true
    }
};

// 快捷操作类型
const QUICK_ACTION_TYPES = {
    // 时间筛选
    FILTER_CURRENT_MONTH: 'filterCurrentMonth',
    FILTER_CURRENT_QUARTER: 'filterCurrentQuarter',
    FILTER_CURRENT_YEAR: 'filterCurrentYear',
    
    // 质量筛选
    EXTRACT_QUALITY_RESOURCES: 'extractQualityResources',
    FILTER_HIGH_VALUE_CUSTOMERS: 'filterHighValueCustomers',
    DETECT_ANOMALIES: 'detectAnomalies',
    
    // 数据清理
    REMOVE_DUPLICATES: 'removeDuplicates',
    FILL_EMPTY_VALUES: 'fillEmptyValues',
    STANDARDIZE_FORMAT: 'standardizeFormat',
    
    // 数据分析
    GENERATE_SUMMARY: 'generateSummary',
    CREATE_PIVOT_TABLE: 'createPivotTable',
    CALCULATE_CORRELATION: 'calculateCorrelation'
};

// 数据处理操作类型
const PROCESSING_TYPES = {
    FILTER: 'filter',
    SORT: 'sort',
    MERGE: 'merge',
    TRANSFORM: 'transform',
    AGGREGATE: 'aggregate',
    EXPORT: 'export'
};

// 导出格式
const EXPORT_FORMATS = {
    EXCEL: 'xlsx',
    CSV: 'csv',
    JSON: 'json',
    XML: 'xml'
};

module.exports = {
    APP_CONSTANTS,
    FILE_CONSTANTS,
    CACHE_CONSTANTS,
    PERFORMANCE_CONSTANTS,
    UI_CONSTANTS,
    ERROR_CODES,
    EVENT_NAMES,
    DEFAULT_CONFIG,
    QUICK_ACTION_TYPES,
    PROCESSING_TYPES,
    EXPORT_FORMATS
};