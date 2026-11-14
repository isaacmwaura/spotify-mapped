import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Hours and days depend on the clock's time zone. Pinning it to UTC makes
    // every check give the same answer on any computer, including GitHub's.
    env: { TZ: 'UTC' },
  },
})
