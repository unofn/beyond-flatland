import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Agent worktrees live under .claude/; their tests belong to their branches.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
