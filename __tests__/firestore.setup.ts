import {
  initializeTestEnvironment,
  RulesTestContext,
  RulesTestEnvironment,
  TestEnvironmentConfig,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll } from '@jest/globals';
import { doc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import { setup, teardown } from 'jest-dev-server';
import { SpawndChildProcess } from 'spawnd';

let testEnv: RulesTestEnvironment;
let servers: SpawndChildProcess[] = [];

beforeAll(async () => {
  servers = await setup({
    command: 'npx firebase emulators:start --only firestore',
    launchTimeout: 30000,
    port: 8080,
    usedPortAction: 'ignore',
  });
}, 30000);

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
  await teardown(servers);
});

interface SetupApp {
  userId?: string;
  data?: { [key: string]: object };
}

export const setupApp = async ({ userId, data }: SetupApp = {}) => {
  const projectId = `rules-spec-${Date.now()}`;
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  const config: TestEnvironmentConfig = {
    projectId,
    firestore: {
      port: 8080,
      host: 'localhost',
      rules,
    },
  };
  testEnv = await initializeTestEnvironment(config);

  if (data) {
    await testEnv.withSecurityRulesDisabled(async (context: RulesTestContext) => {
      for (const key in data) {
        if ({}.hasOwnProperty.call(data, key)) {
          await setDoc(doc(context.firestore(), key), data[key]);
        }
      }
    });
  }

  if (userId) {
    return testEnv.authenticatedContext(userId);
  } else {
    return testEnv.unauthenticatedContext();
  }
};

export const teardownApp = async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
    await testEnv.cleanup();
  }
};
