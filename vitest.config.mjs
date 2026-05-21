import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: './server/test/setup.mjs',
    projects: [
      {
        test: {
          name: 'server',
          include: ['server/**/*.test.mjs'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'client',
          include: ['public/js/**/*.test.mjs'],
          environment: 'happy-dom',
        },
      },
    ],
  },
})
