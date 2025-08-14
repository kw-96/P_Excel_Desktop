module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true,
        jest: true
    },
    extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
    },
    rules: {
        // 代码风格
        'indent': ['error', 4],
        'linebreak-style': ['error', process.platform === 'win32' ? 'windows' : 'unix'],
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        
        // 最佳实践
        'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
        'no-console': 'off', // 允许console.log用于调试
        'no-debugger': 'warn',
        'no-alert': 'warn',
        
        // ES6+
        'prefer-const': 'error',
        'no-var': 'error',
        'arrow-spacing': 'error',
        'template-curly-spacing': 'error',
        
        // 函数
        'func-call-spacing': 'error',
        'no-trailing-spaces': 'error',
        'space-before-blocks': 'error',
        'keyword-spacing': 'error',
        
        // 对象和数组
        'object-curly-spacing': ['error', 'always'],
        'array-bracket-spacing': ['error', 'never'],
        'comma-dangle': ['error', 'never'],
        
        // 注释
        'spaced-comment': ['error', 'always'],
        
        // 安全
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error'
    },
    globals: {
        // Electron全局变量
        'require': 'readonly',
        'module': 'readonly',
        'exports': 'readonly',
        '__dirname': 'readonly',
        '__filename': 'readonly',
        'process': 'readonly',
        'global': 'readonly',
        'Buffer': 'readonly'
    },
    overrides: [
        {
            // 主进程文件
            files: ['src/main/**/*.js'],
            env: {
                node: true,
                browser: false
            }
        },
        {
            // 渲染进程文件
            files: ['src/renderer/**/*.js'],
            env: {
                browser: true,
                node: false
            },
            globals: {
                'electronAPI': 'readonly'
            }
        },
        {
            // Worker进程文件
            files: ['src/workers/**/*.js'],
            env: {
                worker: true,
                node: true
            }
        }
    ]
};