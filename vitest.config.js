import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Node environment — los scripts se cargan via vm.runInContext
    // (los scripts son browser-globals, no ES modules)
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/helpers/ctx.js'],
    include: ['tests/**/*.test.js'],
    reporters: ['verbose'],
  },
})
