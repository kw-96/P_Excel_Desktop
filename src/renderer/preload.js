/**
 * Preload脚本 - 在渲染进程中提供安全的Node.js API访问
 */

const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 文件操作
    openFile: () => ipcRenderer.invoke('file:open'),
    saveFile: (data, options) => ipcRenderer.invoke('file:save', data, options),
    
    // 数据处理
    processData: (data, rules) => ipcRenderer.invoke('data:process', data, rules),
    
    // 系统信息
    getSystemInfo: () => ipcRenderer.invoke('system:info'),
    getMemoryUsage: () => ipcRenderer.invoke('system:memory'),
    
    // 配置管理
    getConfig: (key) => ipcRenderer.invoke('config:get', key),
    setConfig: (key, value) => ipcRenderer.invoke('config:set', key, value),
    
    // 事件监听
    onProgressUpdate: (callback) => {
        ipcRenderer.on('progress:update', (event, data) => callback(data));
    },
    
    onFileProcessed: (callback) => {
        ipcRenderer.on('file:processed', (event, data) => callback(data));
    },
    
    onError: (callback) => {
        ipcRenderer.on('error:occurred', (event, error) => callback(error));
    },
    
    // 移除监听器
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    },
    
    // 应用控制
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    
    // 开发工具
    openDevTools: () => ipcRenderer.invoke('dev:open-tools'),
    
    // 版本信息
    getVersion: () => ipcRenderer.invoke('app:version'),
    getAppInfo: () => ipcRenderer.invoke('app:info')
});

// 监听来自主进程的菜单事件
ipcRenderer.on('menu:open-file', () => {
    window.dispatchEvent(new CustomEvent('menu-open-file'));
});

ipcRenderer.on('menu:save', () => {
    window.dispatchEvent(new CustomEvent('menu-save'));
});

ipcRenderer.on('menu:about', () => {
    window.dispatchEvent(new CustomEvent('menu-about'));
});

// 页面加载完成后的初始化
window.addEventListener('DOMContentLoaded', () => {
    console.log('P_Excel桌面版渲染进程已加载');
    
    // 发送渲染进程就绪信号
    ipcRenderer.send('renderer:ready');
});