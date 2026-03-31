// src/config/configuration.ts
// Central env config — validated at startup

export const configuration = () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),

  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },

  users: {
    me: {
      password: process.env.USER_ME_PASSWORD ?? 'change-me',
    },
    wife: {
      password: process.env.USER_WIFE_PASSWORD ?? 'change-me',
    },
  },

  agentCore: {
    url: process.env.AGENT_CORE_URL ?? 'http://agent_core:8766',
    token: process.env.AGENT_CORE_TOKEN ?? '',
    timeout: parseInt(process.env.AGENT_CORE_TIMEOUT ?? '90000', 10),
  },

  // agent_core CODE root: contains assistants.yaml and prompts/
  // Docker volume: AGENT_CORE_CONFIG_PATH (host) → /data/agent-core (container)
  agentCoreConfigRoot: process.env.AGENT_CORE_CONFIG_ROOT ?? '/data/agent-core',

  // agent_core DATA root: contains users/{me,wife}/agents/*/memory.md etc.
  // Docker volume: AGENT_CORE_DATA_PATH (host) → /data/agent-core-data (container)
  agentCoreDataRoot: process.env.AGENT_CORE_DATA_ROOT ?? '/data/agent-core-data',

  database: {
    url: process.env.DATABASE_URL ?? 'file:/data/studio/studio.db',
  },
});

export type AppConfig = ReturnType<typeof configuration>;
