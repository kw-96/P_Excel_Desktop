/**
 * IPC通道定义 - 定义主进程与渲染进程间的通信通道
 */

// 文件操作通道
const FILE_CHANNELS = {
    OPEN: 'file:open',
    SAVE: 'file:save',
    PARSE: 'file:parse',
    EXPORT: 'file:export',
    DELETE: 'file:delete',
    INFO: 'file:info'
};

// 数据处理通道
const DATA_CHANNELS = {
    PROCESS: 'data:process',
    FILTER: 'data:filter',
    SORT: 'data:sort',
    MERGE: 'data:merge',
    TRANSFORM: 'data:transform',
    VALIDATE: 'data:validate'
};

// 系统信息通道
const SYSTEM_CHANNELS = {
    INFO: 'system:info',
    MEMORY: 'system:memory',
    CPU: 'system:cpu',
    DISK: 'system:disk',
    PERFORMANCE: 'system:performance'
};

// 配置管理通道
const CONFIG_CHANNELS = {
    GET: 'config:get',
    SET: 'config:set',
    RESET: 'config:reset',
    EXPORT: 'config:export',
    IMPORT: 'config:import'
};

// 窗口控制通道
const WINDOW_CHANNELS = {
    MINIMIZE: 'window:minimize',
    MAXIMIZE: 'window:maximize',
    CLOSE: 'window:close',
    RESIZE: 'window:resize',
    FOCUS: 'window:focus'
};

// 应用控制通道
const APP_CHANNELS = {
    VERSION: 'app:version',
    INFO: 'app:info',
    QUIT: 'app:quit',
    RESTART: 'app:restart',
    UPDATE: 'app:update'
};

// 开发工具通道
const DEV_CHANNELS = {
    OPEN_TOOLS: 'dev:open-tools',
    RELOAD: 'dev:reload',
    FORCE_RELOAD: 'dev:force-reload',
    TOGGLE_TOOLS: 'dev:toggle-tools'
};

// 缓存管理通道
const CACHE_CHANNELS = {
    GET: 'cache:get',
    SET: 'cache:set',
    DELETE: 'cache:delete',
    CLEAR: 'cache:clear',
    INFO: 'cache:info',
    OPTIMIZE: 'cache:optimize'
};

// Worker进程通道
const WORKER_CHANNELS = {
    CREATE: 'worker:create',
    DESTROY: 'worker:destroy',
    SEND: 'worker:send',
    RECEIVE: 'worker:receive',
    STATUS: 'worker:status'
};

// 进度通知通道
const PROGRESS_CHANNELS = {
    UPDATE: 'progress:update',
    START: 'progress:start',
    COMPLETE: 'progress:complete',
    ERROR: 'progress:error',
    CANCEL: 'progress:cancel'
};

// 错误处理通道
const ERROR_CHANNELS = {
    OCCURRED: 'error:occurred',
    REPORT: 'error:report',
    RECOVER: 'error:recover',
    LOG: 'error:log'
};

// 菜单事件通道
const MENU_CHANNELS = {
    OPEN_FILE: 'menu:open-file',
    SAVE: 'menu:save',
    SAVE_AS: 'menu:save-as',
    EXPORT: 'menu:export',
    PREFERENCES: 'menu:preferences',
    ABOUT: 'menu:about'
};

// 通知通道
const NOTIFICATION_CHANNELS = {
    SHOW: 'notification:show',
    HIDE: 'notification:hide',
    CLICK: 'notification:click',
    CLOSE: 'notification:close'
};

// 日志通道
const LOG_CHANNELS = {
    INFO: 'log:info',
    WARN: 'log:warn',
    ERROR: 'log:error',
    DEBUG: 'log:debug',
    CLEAR: 'log:clear'
};

// 数据传输通道（大数据分块传输）
const TRANSFER_CHANNELS = {
    START: 'data:transfer-start',
    CHUNK: 'data:transfer-chunk',
    COMPLETE: 'data:transfer-complete',
    ERROR: 'data:transfer-error',
    CANCEL: 'data:transfer-cancel'
};

// 渲染进程事件通道
const RENDERER_CHANNELS = {
    READY: 'renderer:ready',
    LOADED: 'renderer:loaded',
    ERROR: 'renderer:error',
    UNLOAD: 'renderer:unload'
};

// 主进程事件通道
const MAIN_CHANNELS = {
    READY: 'main:ready',
    SHUTDOWN: 'main:shutdown',
    ERROR: 'main:error',
    WARNING: 'main:warning'
};

// 快捷操作通道
const QUICK_ACTION_CHANNELS = {
    EXECUTE: 'quick-action:execute',
    LIST: 'quick-action:list',
    REGISTER: 'quick-action:register',
    UNREGISTER: 'quick-action:unregister'
};

// 所有通道的集合
const ALL_CHANNELS = {
    FILE: FILE_CHANNELS,
    DATA: DATA_CHANNELS,
    SYSTEM: SYSTEM_CHANNELS,
    CONFIG: CONFIG_CHANNELS,
    WINDOW: WINDOW_CHANNELS,
    APP: APP_CHANNELS,
    DEV: DEV_CHANNELS,
    CACHE: CACHE_CHANNELS,
    WORKER: WORKER_CHANNELS,
    PROGRESS: PROGRESS_CHANNELS,
    ERROR: ERROR_CHANNELS,
    MENU: MENU_CHANNELS,
    NOTIFICATION: NOTIFICATION_CHANNELS,
    LOG: LOG_CHANNELS,
    TRANSFER: TRANSFER_CHANNELS,
    RENDERER: RENDERER_CHANNELS,
    MAIN: MAIN_CHANNELS,
    QUICK_ACTION: QUICK_ACTION_CHANNELS
};

// 获取所有通道名称的数组
function getAllChannelNames() {
    const channels = [];
    
    function extractChannels(obj) {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                channels.push(obj[key]);
            } else if (typeof obj[key] === 'object') {
                extractChannels(obj[key]);
            }
        }
    }
    
    extractChannels(ALL_CHANNELS);
    return channels;
}

// 验证通道名称是否有效
function isValidChannel(channelName) {
    const allChannels = getAllChannelNames();
    return allChannels.includes(channelName);
}

// 根据前缀获取通道
function getChannelsByPrefix(prefix) {
    const allChannels = getAllChannelNames();
    return allChannels.filter(channel => channel.startsWith(prefix));
}

module.exports = {
    FILE_CHANNELS,
    DATA_CHANNELS,
    SYSTEM_CHANNELS,
    CONFIG_CHANNELS,
    WINDOW_CHANNELS,
    APP_CHANNELS,
    DEV_CHANNELS,
    CACHE_CHANNELS,
    WORKER_CHANNELS,
    PROGRESS_CHANNELS,
    ERROR_CHANNELS,
    MENU_CHANNELS,
    NOTIFICATION_CHANNELS,
    LOG_CHANNELS,
    TRANSFER_CHANNELS,
    RENDERER_CHANNELS,
    MAIN_CHANNELS,
    QUICK_ACTION_CHANNELS,
    ALL_CHANNELS,
    getAllChannelNames,
    isValidChannel,
    getChannelsByPrefix
};