import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from 'bun:test';

import {
  initProject,
  migrateProject,
  planProject,
  runDoctor,
  updateProject
} from '../src/index.js';
import type { AgentIntakeManifestV2, SeliConfigV2, SeliLockV2 } from '../src/domain/contracts.js';

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function readConfig(projectRoot: string): SeliConfigV2 {
  return readJson<SeliConfigV2>(path.join(projectRoot, '.selirc'));
}

function readLock(projectRoot: string): SeliLockV2 {
  return readJson<SeliLockV2>(path.join(projectRoot, '.seli.lock'));
}

function createFakeSkillPackage(rootPath: string, skills: string[]): void {
  for (const skill of skills) {
    const skillPath = path.join(rootPath, 'skills', skill);
    fs.mkdirSync(skillPath, { recursive: true });
    fs.writeFileSync(path.join(skillPath, 'SKILL.md'), `# ${skill}\n`, 'utf8');
  }
}

function createFakeEccSource(rootPath: string): void {
  createFakeSkillPackage(rootPath, [
    'tdd-workflow',
    'verification-loop',
    'coding-standards',
    'backend-patterns',
    'security-review',
    'api-design',
    'documentation-lookup',
    'frontend-patterns',
    'python-patterns',
    'python-testing',
    'database-migrations'
  ]);
}

function writeIntakeV2(rootPath: string, manifest: AgentIntakeManifestV2): string {
  const intakePath = path.join(rootPath, 'manifest.json');
  writeJson(intakePath, manifest);
  return intakePath;
}

test('init writes only .selirc/.seli.lock and no compat outputs', () => {
  const eccRoot = makeTempDir('seli-ecc-');
  const projectRoot = makeTempDir('seli-project-');
  const intakeRoot = makeTempDir('seli-intake-');
  createFakeEccSource(eccRoot);

  const intakePath = writeIntakeV2(intakeRoot, {
    schemaVersion: 2,
    target: {
      projectPath: projectRoot,
      requestedOperation: 'auto',
      profile: 'default'
    },
    providers: [
      {
        providerId: 'ecc',
        rootPath: eccRoot,
        requestedSkills: ['api-design', 'database-migrations']
      }
    ],
    project: {
      requestedProjectSkills: ['solution-blueprint'],
      extraAgents: ['explorer']
    }
  });

  initProject({ projectRoot, intakePath });
  const config = readConfig(projectRoot);
  const lock = readLock(projectRoot);

  expect(config.version).toBe(2);
  expect(lock.version).toBe(2);
  expect(config.layers.team.providers[0]?.skills).toEqual(['api-design', 'database-migrations']);
  expect(config.layers.project.extraAgents).toEqual(['explorer']);
  expect(fs.existsSync(path.join(projectRoot, '.agents', 'plugins', 'marketplace.json'))).toBe(false);
  expect(fs.existsSync(path.join(projectRoot, 'plugins'))).toBe(false);

  const skillTeam = fs.readFileSync(path.join(projectRoot, '.agents', 'skill_team.md'), 'utf8');
  expect(skillTeam).toContain('## system_prompt');
  expect(skillTeam).toContain('本项目由 Seli 初始化，请参考本地技能包进行代码生成。');
});

test('plan -> update remains idempotent', () => {
  const eccRoot = makeTempDir('seli-ecc-');
  const projectRoot = makeTempDir('seli-idempotent-');
  const intakeRoot = makeTempDir('seli-intake-');
  createFakeEccSource(eccRoot);

  const intakePath = writeIntakeV2(intakeRoot, {
    schemaVersion: 2,
    target: { projectPath: projectRoot, requestedOperation: 'auto' },
    providers: [{ providerId: 'ecc', rootPath: eccRoot }]
  });

  initProject({ projectRoot, intakePath });
  const followUpPlan = planProject({ projectRoot, intakePath });
  expect(followUpPlan.operations.length).toBe(0);
});

test('unsupported legacy state is rejected for init and migrate', () => {
  const projectRoot = makeTempDir('seli-legacy-');
  writeJson(path.join(projectRoot, '.ai-tool-init', 'config.json'), { version: 1 });

  expect(() => initProject({ projectRoot })).toThrow(/Unsupported legacy state/);
  expect(() => migrateProject({ projectRoot })).toThrow(/Legacy state is no longer supported/);
});

test('legacy intake schema version 1 is rejected', () => {
  const projectRoot = makeTempDir('seli-intake-legacy-project-');
  const intakePath = path.join(projectRoot, 'intake-v1.json');
  writeJson(intakePath, {
    version: 1,
    targetProjectPath: projectRoot
  });

  expect(() => planProject({ projectRoot, intakePath })).toThrow(/Legacy intake manifest is no longer supported/);
});

test('SELI_ECC_ROOT is honored and old env fallback is ignored', () => {
  const projectRoot = makeTempDir('seli-env-project-');
  const newRoot = makeTempDir('seli-env-new-');
  const oldRoot = makeTempDir('seli-env-old-');
  createFakeSkillPackage(newRoot, ['tdd-workflow']);
  createFakeSkillPackage(oldRoot, ['backend-patterns']);

  process.env.SELI_ECC_ROOT = newRoot;
  process.env.AI_TOOL_INIT_ECC_ROOT = oldRoot;
  try {
    initProject({ projectRoot });
  } finally {
    delete process.env.SELI_ECC_ROOT;
    delete process.env.AI_TOOL_INIT_ECC_ROOT;
  }

  const lock = readLock(projectRoot);
  expect(lock.resolved.providers[0]?.resolvedSourceRoot?.includes(path.resolve(newRoot))).toBe(true);
});

test('update normalizes .agents/skills and removes duplicate project-skill directories', () => {
  const eccRoot = makeTempDir('seli-ecc-');
  const projectRoot = makeTempDir('seli-dup-clean-');
  createFakeEccSource(eccRoot);

  initProject({
    projectRoot,
    providerRoots: { ecc: eccRoot }
  });

  const duplicateDir = path.join(projectRoot, '.agents', 'skills', 'repo-governance');
  fs.mkdirSync(duplicateDir, { recursive: true });
  fs.writeFileSync(path.join(duplicateDir, 'SKILL.md'), '# duplicate\n', 'utf8');

  const doctorBefore = runDoctor({ projectRoot, providerRoots: { ecc: eccRoot } });
  expect(doctorBefore.ok).toBe(false);
  expect(doctorBefore.errors.join('\n')).toContain('Duplicate skill IDs found in both .codex/skills and .agents/skills');

  updateProject({
    projectRoot,
    providerRoots: { ecc: eccRoot },
    force: true
  });

  expect(fs.existsSync(duplicateDir)).toBe(false);
  const doctorAfter = runDoctor({ projectRoot, providerRoots: { ecc: eccRoot } });
  expect(doctorAfter.ok).toBe(true);
});

test('CLI providers/plugins/inspect reflect active plugin set (without compat renderer)', () => {
  const repoRoot = path.join(import.meta.dir, '..');
  const cliPath = path.join(repoRoot, 'src', 'cli.ts');
  const eccRoot = makeTempDir('seli-ecc-');
  const projectRoot = makeTempDir('seli-cli-');
  createFakeEccSource(eccRoot);

  const providersJson = execFileSync(process.execPath, [cliPath, 'providers', 'list', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  const providers = JSON.parse(providersJson) as { providers: string[] };
  expect(providers.providers).toContain('ecc');

  const pluginsJson = execFileSync(process.execPath, [cliPath, 'plugins', 'list', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  const plugins = JSON.parse(pluginsJson) as { renderers: string[]; doctorChecks: string[] };
  expect(plugins.renderers).toEqual(expect.arrayContaining(['base', 'codex', 'claude']));
  expect(plugins.renderers).not.toContain('compat');
  expect(plugins.doctorChecks).toContain('duplicate-skills');

  const inspectJson = execFileSync(
    process.execPath,
    [cliPath, 'inspect', 'plan', '--project', projectRoot, '--provider-root', `ecc=${eccRoot}`, '--json'],
    {
      cwd: repoRoot,
      encoding: 'utf8'
    }
  );
  const inspect = JSON.parse(inspectJson) as {
    pluginResolutions: { providers: string[] };
    pipelineFingerprint: string;
  };
  expect(inspect.pluginResolutions.providers).toContain('ecc');
  expect(inspect.pipelineFingerprint.length).toBeGreaterThan(10);
});

test('CLI explain mode prints Seli banner and init status lines', () => {
  const repoRoot = path.join(import.meta.dir, '..');
  const cliPath = path.join(repoRoot, 'src', 'cli.ts');
  const helpOut = execFileSync(process.execPath, [cliPath], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  expect(helpOut).toContain('Seli v1.0.0');
  expect(helpOut).toContain('seli init --project');

  const eccRoot = makeTempDir('seli-ecc-');
  const projectRoot = makeTempDir('seli-cli-init-');
  createFakeEccSource(eccRoot);
  const initOut = execFileSync(
    process.execPath,
    [cliPath, 'init', '--project', projectRoot, '--provider-root', `ecc=${eccRoot}`],
    {
      cwd: repoRoot,
      encoding: 'utf8'
    }
  );

  expect(initOut).toContain('[Seli] 🦭 Searching for local skills (Flink, Spark, StarRocks...)...');
  expect(initOut).toContain('[Seli] ✨ Sealing the configuration for your agent...');
  expect(initOut).toContain("[Seli] ✅ Project initialized. Now ask Claude or Codex to 'read Seli context'.");
});

test('CLI json mode remains pure json without banner or status lines', () => {
  const repoRoot = path.join(import.meta.dir, '..');
  const cliPath = path.join(repoRoot, 'src', 'cli.ts');
  const eccRoot = makeTempDir('seli-ecc-');
  const projectRoot = makeTempDir('seli-cli-json-');
  createFakeEccSource(eccRoot);

  const jsonOut = execFileSync(
    process.execPath,
    [cliPath, 'init', '--project', projectRoot, '--provider-root', `ecc=${eccRoot}`, '--json'],
    {
      cwd: repoRoot,
      encoding: 'utf8'
    }
  );
  expect(jsonOut.includes('Seli v')).toBe(false);
  expect(jsonOut.includes('[Seli]')).toBe(false);
  const parsed = JSON.parse(jsonOut) as { plan: { command: string } };
  expect(parsed.plan.command).toBe('init');
});
