// Conventional commits: feat:, fix:, chore:, docs:, refactor:, test:, ...
import type { UserConfig } from '@commitlint/types';

const config: UserConfig = { extends: ['@commitlint/config-conventional'] };

export default config;
