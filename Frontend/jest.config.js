module.exports = {
    preset: 'react-native',
    setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
    testMatch: [
        '<rootDir>/__tests__/**/*.(test|spec).{js,jsx,ts,tsx}',
        '<rootDir>/src/**/__tests__/**/*.(test|spec).{js,jsx,ts,tsx}',
        '<rootDir>/src/**/?(*.)(test|spec).{js,jsx,ts,tsx}'
    ],
    collectCoverageFrom: [
        'src/**/*.{js,jsx,ts,tsx}',
        'screens/**/*.{js,jsx,ts,tsx}',
        'components/**/*.{js,jsx,ts,tsx}',
        'services/**/*.{js,jsx,ts,tsx}',
        'utils/**/*.{js,jsx,ts,tsx}',
        '!src/**/*.d.ts',
        '!src/index.js',
        '!**/node_modules/**',
        '!**/*.config.js',
        '!**/coverage/**'
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    },
    coverageReporters: [
        'html',
        'text',
        'text-summary',
        'lcov',
        'json'
    ],
    transform: {
        '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
    },
    transformIgnorePatterns: [
        'node_modules/(?!(react-native|@react-native|react-native-vector-icons|react-native-camera|@react-navigation)/)'
    ],
    moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
    },
    moduleFileExtensions: [
        'ts',
        'tsx',
        'js',
        'jsx',
        'json',
        'node'
    ],
    testEnvironment: 'jsdom',
    globals: {
        __DEV__: true
    },
    setupFiles: [
        '<rootDir>/__tests__/jest.setup.js'
    ],
    verbose: true,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10000,
    maxWorkers: '50%'
}; 