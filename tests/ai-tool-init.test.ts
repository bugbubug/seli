import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { createPlan, initProject, planProject, runDoctor, updateProject } from '../src/index.js';
import type { AgentIntakeManifest, AiToolInitConfig, AiToolInitLock } from '../src/types.js';

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readConfig(projectRoot: string): AiToolInitConfig {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, '.ai-tool-init', 'config.json'), 'utf8')) as AiToolInitConfig;
}

function readLock(projectRoot: string): AiToolInitLock {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, '.ai-tool-init', 'lock.json'), 'utf8')) as AiToolInitLock;
}

function writeIntakeManifest(rootPath: string, manifest: AgentIntakeManifest): string {
  const intakePath = path.join(rootPath, 'manifest.json');
  writeJson(intakePath, manifest);
  return intakePath;
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

function createLegacyPolymarketProject(projectRoot: string, eccRoot: string): void {
  fs.mkdirSync(path.join(projectRoot, '.agents', 'skills'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, '.agents', 'plugins'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, '.codex', 'agents'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'plugins', 'ai-tool-init-compat', '.codex-plugin'), {
    recursive: true
  });

  fs.symlinkSync(
    path.join(eccRoot, 'skills', 'tdd-workflow'),
    path.join(projectRoot, '.agents', 'skills', 'tdd-workflow')
  );
  fs.symlinkSync(
    path.join(eccRoot, 'skills', 'verification-loop'),
    path.join(projectRoot, '.agents', 'skills', 'verification-loop')
  );

  writeJson(path.join(projectRoot, '.agents', 'plugins', 'marketplace.json'), {
    name: 'legacy-local',
    plugins: [{ name: 'ai-tool-init-compat' }]
  });
  writeJson(path.join(projectRoot, 'plugins', 'ai-tool-init-compat', '.codex-plugin', 'plugin.json'), {
    name: 'ai-tool-init-compat'
  });
  fs.writeFileSync(path.join(projectRoot, '.codex', 'agents', 'explorer.toml'), 'name = "explorer"\n', 'utf8');
}

function createLegacyUnifiedProject(projectRoot: string, eccRoot: string): void {
  fs.mkdirSync(path.join(projectRoot, '.codex', 'skills', 'risk-audit'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, '.codex', 'agents'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, '.agents', 'skills'), { recursive: true });

  fs.writeFileSync(path.join(projectRoot, '.codex', 'skills', 'risk-audit', 'SKILL.md'), '# risk-audit\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, '.codex', 'agents', 'reviewer.toml'), 'name = "reviewer"\n', 'utf8');
  fs.symlinkSync(
    path.join(eccRoot, 'skills', 'backend-patterns'),
    path.join(projectRoot, '.agents', 'skills', 'backend-patterns')
  );
}

test('init bootstraps an empty repository with repo-local codex/claude/team layers', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-project-');
  createFakeEccSource(eccRoot);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;

  initProject({ projectRoot, profileId: 'default' });

  expect(fs.existsSync(path.join(projectRoot, '.ai-tool-init', 'config.json'))).toBe(true);
  expect(fs.existsSync(path.join(projectRoot, '.ai-tool-init', 'lock.json'))).toBe(true);
  expect(fs.existsSync(path.join(projectRoot, 'AGENTS.md'))).toBe(true);
  expect(fs.lstatSync(path.join(projectRoot, 'CLAUDE.md')).isSymbolicLink()).toBe(true);
  expect(fs.existsSync(path.join(projectRoot, '.codex', 'config.toml'))).toBe(true);
  expect(fs.existsSync(path.join(projectRoot, '.claude', 'README.md'))).toBe(true);
  expect(fs.lstatSync(path.join(projectRoot, '.claude', 'skills')).isSymbolicLink()).toBe(true);
  expect(fs.lstatSync(path.join(projectRoot, '.agents', 'skills', 'tdd-workflow')).isSymbolicLink()).toBe(true);
  expect(fs.existsSync(path.join(projectRoot, '.codex', 'skills', 'team-skill-evolution', 'SKILL.md'))).toBe(true);
  expect(fs.existsSync(path.join(projectRoot, '.codex', 'skills', 'team-skill-sync', 'SKILL.md'))).toBe(true);
  expect(
    fs.existsSync(path.join(projectRoot, 'plugins', 'ai-tool-init-compat', '.codex-plugin', 'plugin.json'))
  ).toBe(true);
  expect(fs.readlinkSync(path.join(projectRoot, '.claude', 'skills'))).toBe('../.codex/skills');
});

test('repository exposes a root AGENTS contract and CLAUDE compatibility entrypoint', () => {
  const repoRoot = path.join(import.meta.dir, '..');
  expect(fs.existsSync(path.join(repoRoot, 'AGENTS.md'))).toBe(true);
  expect(fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8')).toMatch(/intake\/manifest\.json/);
  expect(fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8')).toMatch(/teamPackages/);
  expect(fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8')).toMatch(/plan/);
  expect(fs.lstatSync(path.join(repoRoot, 'CLAUDE.md')).isSymbolicLink()).toBe(true);
});

test('update bootstraps a legacy polymarket-style repository without a manifest', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-polymarket-');
  createFakeEccSource(eccRoot);
  createLegacyPolymarketProject(projectRoot, eccRoot);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;

  updateProject({ projectRoot });

  const config = readConfig(projectRoot);
  const provider = config.layers.team.providers[0];
  expect(provider).toBeDefined();
  if (!provider) {
    throw new Error('Expected a default provider after update bootstrap.');
  }

  expect(config.layers.project.compatPlugin.enabled).toBe(true);
  expect(provider.skills).toEqual(['tdd-workflow', 'verification-loop']);
  expect(fs.existsSync(path.join(projectRoot, '.codex', 'config.toml'))).toBe(true);
});

test('update bootstraps a legacy unified-pay style repository and preserves detected project skills as external', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-unified-');
  createFakeEccSource(eccRoot);
  createLegacyUnifiedProject(projectRoot, eccRoot);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;

  updateProject({ projectRoot });

  const config = readConfig(projectRoot);
  const riskAuditSkill = config.layers.project.skills.find(skill => skill.id === 'risk-audit');
  expect(riskAuditSkill?.id).toBe('risk-audit');
  expect(riskAuditSkill?.managed).toBe(false);
  expect(fs.readFileSync(path.join(projectRoot, '.codex', 'skills', 'risk-audit', 'SKILL.md'), 'utf8')).toBe(
    '# risk-audit\n'
  );
});

test('plan is consistent with apply and update is idempotent after initialization', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-plan-');
  createFakeEccSource(eccRoot);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;

  const planBeforeApply = planProject({ projectRoot, profileId: 'default' });
  const initResult = initProject({ projectRoot, profileId: 'default' });
  const operationKeys = planBeforeApply.operations.map(item => `${item.action}:${item.path}`);
  const applyKeys = initResult.plan.operations.map(item => `${item.action}:${item.path}`);
  expect(applyKeys).toEqual(operationKeys);

  const followUpPlan = createPlan({ command: 'update', projectRoot });
  expect(followUpPlan.operations.length).toBe(0);
});

test('doctor reports missing provider roots after the external team source disappears', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-doctor-');
  createFakeEccSource(eccRoot);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;

  initProject({ projectRoot, profileId: 'default' });
  fs.rmSync(eccRoot, { recursive: true, force: true });

  const doctor = runDoctor({ projectRoot });
  expect(doctor.ok).toBe(false);
  expect(doctor.errors.join('\n')).toMatch(/Provider source root missing/);
});

test('intake drives agent-selected skills, agents, compat, and provider persistence', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-intake-project-');
  const intakeRoot = makeTempDir('ai-tool-init-intake-');
  createFakeEccSource(eccRoot);

  fs.mkdirSync(path.join(intakeRoot, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(intakeRoot, 'docs', 'requirements.md'), '# requirements\n', 'utf8');

  const intakePath = writeIntakeManifest(intakeRoot, {
    version: 1,
    targetProjectPath: projectRoot,
    requestedOperation: 'auto',
    providerRoots: {
      ecc: eccRoot
    },
    documents: [
      {
        path: './docs/requirements.md',
        label: 'Requirements',
        kind: 'requirements',
        appliesTo: 'project'
      }
    ],
    requestedTeamSkills: ['api-design', 'documentation-lookup'],
    requestedProjectSkills: ['solution-blueprint'],
    extraAgents: ['explorer'],
    compatPlugin: false,
    agentDecisions: [
      {
        summary: 'Enable solution-blueprint as the only managed project skill.',
        appliesTo: 'project',
        sourcePaths: ['./docs/requirements.md']
      }
    ],
    notes: ['Use intake-controlled settings for this bootstrap run.']
  });

  const result = updateProject({ projectRoot, intakePath });
  const config = readConfig(projectRoot);
  const provider = config.layers.team.providers[0];

  expect(result.plan.command).toBe('init');
  expect(provider?.sourceRoot).toBe(eccRoot);
  expect(provider?.skills).toEqual(['api-design', 'documentation-lookup']);
  expect(config.layers.project.skills.map(skill => skill.id)).toEqual(
    expect.arrayContaining(['repo-governance', 'change-closeout', 'team-skill-evolution', 'team-skill-sync', 'solution-blueprint'])
  );
  expect(config.layers.project.extraAgents).toEqual(['explorer']);
  expect(config.layers.project.compatPlugin.enabled).toBe(false);
  expect(fs.existsSync(path.join(projectRoot, '.codex', 'agents', 'explorer.toml'))).toBe(true);
  expect(fs.existsSync(path.join(projectRoot, '.codex', 'agents', 'reviewer.toml'))).toBe(false);
  expect(fs.existsSync(path.join(projectRoot, '.agents', 'plugins', 'marketplace.json'))).toBe(false);
  expect(fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8')).toMatch(/Future changes should prefer rerunning `ai-tool-init update`/);
  expect(runDoctor({ projectRoot, intakePath }).ok).toBe(true);
});

test('team skill policy auto-selects ECC skills from uploaded requirements and architecture docs', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-policy-project-');
  const intakeRoot = makeTempDir('ai-tool-init-policy-intake-');
  createFakeEccSource(eccRoot);

  fs.mkdirSync(path.join(intakeRoot, 'docs'), { recursive: true });
  fs.writeFileSync(
    path.join(intakeRoot, 'docs', 'requirements.md'),
    [
      '# Requirements',
      'Build a Python FastAPI service.',
      'Expose API endpoints and schemas for external integrations.',
      'Persist data in Postgres and ship database migrations safely.'
    ].join('\n'),
    'utf8'
  );

  const intakePath = writeIntakeManifest(intakeRoot, {
    version: 1,
    targetProjectPath: projectRoot,
    requestedOperation: 'auto',
    providerRoots: {
      ecc: eccRoot
    },
    documents: [
      {
        path: './docs/requirements.md',
        label: 'Product requirements',
        kind: 'requirements',
        appliesTo: 'project'
      }
    ],
    notes: ['Prefer the policy-driven team skill selection flow.']
  });

  initProject({ projectRoot, intakePath });

  const teamSkills = readConfig(projectRoot).layers.team.providers[0]?.skills ?? [];
  expect(teamSkills.includes('python-patterns')).toBe(true);
  expect(teamSkills.includes('api-design')).toBe(true);
  expect(teamSkills.includes('database-migrations')).toBe(true);
});

test('project skill blueprints generate rich built-in skills from intake decisions', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-blueprint-project-');
  const intakeRoot = makeTempDir('ai-tool-init-blueprint-intake-');
  createFakeEccSource(eccRoot);

  fs.mkdirSync(path.join(intakeRoot, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(intakeRoot, 'docs', 'architecture.md'), '# Architecture\n', 'utf8');

  const intakePath = writeIntakeManifest(intakeRoot, {
    version: 1,
    targetProjectPath: projectRoot,
    requestedOperation: 'auto',
    providerRoots: {
      ecc: eccRoot
    },
    documents: [
      {
        path: './docs/architecture.md',
        label: 'Architecture note',
        kind: 'architecture',
        appliesTo: 'project'
      }
    ],
    projectSkillBlueprints: [
      {
        id: 'payment-orchestration',
        description: 'Repository-specific orchestration rules for payment flows.',
        whenToUse: ['Use for payment state transitions and provider callbacks.'],
        workflow: [
          'Read the architecture note before changing payment orchestration.',
          'Keep provider callback handling idempotent.'
        ],
        guardrails: ['Do not bypass payment state validation.'],
        relatedTeamSkills: ['api-design', 'backend-patterns'],
        sourcePaths: ['./docs/architecture.md'],
        sourceDocumentLabels: ['Architecture note']
      }
    ],
    agentDecisions: [
      {
        summary: 'Generate a payment-orchestration project skill from the uploaded architecture note.',
        appliesTo: 'project',
        sourcePaths: ['./docs/architecture.md']
      }
    ]
  });

  initProject({ projectRoot, intakePath });

  const generatedSkill = fs.readFileSync(
    path.join(projectRoot, '.codex', 'skills', 'payment-orchestration', 'SKILL.md'),
    'utf8'
  );
  expect(generatedSkill).toMatch(/## When To Use/);
  expect(generatedSkill).toMatch(/payment state transitions/);
  expect(generatedSkill).toMatch(/## Workflow/);
  expect(generatedSkill).toMatch(/idempotent/);
  expect(generatedSkill).toMatch(/## Related Team Skills/);
  expect(generatedSkill).toMatch(/`api-design`/);
  expect(generatedSkill).toMatch(/Architecture note/);

  const projectSkill = readConfig(projectRoot).layers.project.skills.find(skill => skill.id === 'payment-orchestration');
  expect(projectSkill?.workflow?.includes('Keep provider callback handling idempotent.')).toBe(true);
});

test('project built-in skills override team skills with the same id', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-collision-');
  createFakeEccSource(eccRoot);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;

  initProject({ projectRoot, profileId: 'default' });
  const configPath = path.join(projectRoot, '.ai-tool-init', 'config.json');
  const config = readConfig(projectRoot);
  config.layers.project.skills.push({
    id: 'backend-patterns',
    description: 'Project override of backend-patterns.',
    managed: true
  });
  writeJson(configPath, config);

  updateProject({ projectRoot });
  const plan = createPlan({ command: 'plan', projectRoot });
  expect(fs.existsSync(path.join(projectRoot, '.codex', 'skills', 'backend-patterns', 'SKILL.md'))).toBe(true);
  expect(fs.lstatSync(path.join(projectRoot, '.agents', 'skills', 'backend-patterns')).isSymbolicLink()).toBe(true);
  expect(plan.summary.collisions).toEqual(['backend-patterns']);
});

test('compat plugin files are removed when compat is disabled in the manifest', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-compat-');
  createFakeEccSource(eccRoot);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;

  initProject({ projectRoot, profileId: 'default' });
  const configPath = path.join(projectRoot, '.ai-tool-init', 'config.json');
  const config = readConfig(projectRoot);
  config.layers.project.compatPlugin.enabled = false;
  writeJson(configPath, config);

  updateProject({ projectRoot });

  expect(fs.existsSync(path.join(projectRoot, '.agents', 'plugins', 'marketplace.json'))).toBe(false);
  expect(
    fs.existsSync(path.join(projectRoot, 'plugins', 'ai-tool-init-compat', '.codex-plugin', 'plugin.json'))
  ).toBe(false);
});

test('managed drift blocks update by default and force rebuild restores generated files', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-drift-');
  createFakeEccSource(eccRoot);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;

  initProject({ projectRoot, profileId: 'default' });
  fs.appendFileSync(path.join(projectRoot, 'AGENTS.md'), '\nuser drift\n', 'utf8');

  let driftError: (Error & { code?: string }) | null = null;
  try {
    updateProject({ projectRoot });
  } catch (error) {
    driftError = error as Error & { code?: string };
  }

  expect(driftError?.code).toBe('MANAGED_DRIFT');

  updateProject({ projectRoot, force: true });
  const agents = fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8');
  expect(agents.includes('user drift')).toBe(false);
});

test('requestedOperation auto chooses update for legacy repositories', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-auto-legacy-');
  const intakeRoot = makeTempDir('ai-tool-init-auto-intake-');
  createFakeEccSource(eccRoot);
  createLegacyUnifiedProject(projectRoot, eccRoot);

  const intakePath = writeIntakeManifest(intakeRoot, {
    version: 1,
    targetProjectPath: projectRoot,
    requestedOperation: 'auto',
    providerRoots: {
      ecc: eccRoot
    }
  });

  const result = initProject({ projectRoot, intakePath });
  expect(result.plan.command).toBe('update');
});

test('cli provider-root overrides env roots and persists into target config', () => {
  const cliPath = path.join(import.meta.dir, '..', 'src', 'cli.ts');
  const repoRoot = path.join(import.meta.dir, '..');
  const envRoot = makeTempDir('ai-tool-init-ecc-env-');
  const cliRoot = makeTempDir('ai-tool-init-ecc-cli-');
  const projectRoot = makeTempDir('ai-tool-init-cli-provider-');
  createFakeEccSource(envRoot);
  createFakeEccSource(cliRoot);

  const planJson = execFileSync(
    process.execPath,
    [cliPath, 'plan', '--project', projectRoot, '--provider-root', `ecc=${cliRoot}`, '--json'],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        AI_TOOL_INIT_ECC_ROOT: envRoot
      },
      encoding: 'utf8'
    }
  );

  const plan = JSON.parse(planJson) as ReturnType<typeof planProject>;
  expect(plan.config.layers.team.providers[0]?.sourceRoot).toBe(cliRoot);
  expect(plan.lockContent.resolved.providers[0]?.resolvedSourceRoot).toBe(cliRoot);

  execFileSync(
    process.execPath,
    [cliPath, 'init', '--project', projectRoot, '--provider-root', `ecc=${cliRoot}`],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        AI_TOOL_INIT_ECC_ROOT: envRoot
      },
      encoding: 'utf8'
    }
  );

  expect(readConfig(projectRoot).layers.team.providers[0]?.sourceRoot).toBe(cliRoot);
});

test('cli plan json does not write to HOME and exposes the same operation set as apply', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-cli-');
  const homeRoot = makeTempDir('ai-tool-init-home-');
  createFakeEccSource(eccRoot);

  const cliPath = path.join(import.meta.dir, '..', 'src', 'cli.ts');
  const planJson = execFileSync(process.execPath, [cliPath, 'plan', '--project', projectRoot, '--profile', 'default', '--json'], {
    cwd: path.join(import.meta.dir, '..'),
    env: {
      ...process.env,
      AI_TOOL_INIT_ECC_ROOT: eccRoot,
      HOME: homeRoot
    },
    encoding: 'utf8'
  });

  const plan = JSON.parse(planJson) as ReturnType<typeof planProject>;
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;
  const initResult = initProject({ projectRoot, profileId: 'default' });

  expect(initResult.plan.operations.map(item => `${item.action}:${item.path}`)).toEqual(
    plan.operations.map(item => `${item.action}:${item.path}`)
  );
  expect(fs.existsSync(path.join(homeRoot, '.codex'))).toBe(false);
  expect(fs.existsSync(path.join(homeRoot, '.claude'))).toBe(false);
});

test('multiple team packages are scanned and auto-selection can pull skills from different packages', () => {
  const projectRoot = makeTempDir('ai-tool-init-multi-package-project-');
  const intakeRoot = makeTempDir('ai-tool-init-multi-package-intake-');
  const corePackage = makeTempDir('ai-tool-init-multi-package-core-');
  const dataPackage = makeTempDir('ai-tool-init-multi-package-data-');

  createFakeSkillPackage(corePackage, ['tdd-workflow', 'verification-loop', 'coding-standards', 'python-patterns']);
  createFakeSkillPackage(dataPackage, ['api-design', 'database-migrations']);

  fs.mkdirSync(path.join(intakeRoot, 'docs'), { recursive: true });
  fs.writeFileSync(
    path.join(intakeRoot, 'docs', 'requirements.md'),
    [
      '# Requirements',
      'Build a Python service.',
      'Expose API schemas.',
      'Ship Postgres migrations.'
    ].join('\n'),
    'utf8'
  );

  const intakePath = writeIntakeManifest(intakeRoot, {
    version: 1,
    targetProjectPath: projectRoot,
    requestedOperation: 'auto',
    teamPackages: [
      { providerId: 'ecc', rootPath: corePackage, label: 'core', priority: 0 },
      { providerId: 'ecc', rootPath: dataPackage, label: 'data', priority: 1 }
    ],
    documents: [
      {
        path: './docs/requirements.md',
        label: 'Requirements',
        kind: 'requirements',
        appliesTo: 'project'
      }
    ]
  });

  const result = initProject({ projectRoot, intakePath });
  const provider = readConfig(projectRoot).layers.team.providers[0];

  expect(provider?.packages?.length).toBe(2);
  expect(provider?.skills).toEqual(
    expect.arrayContaining(['tdd-workflow', 'verification-loop', 'coding-standards', 'python-patterns', 'api-design', 'database-migrations'])
  );
  expect(result.plan.summary.resolvedPackageCount).toBe(2);
  expect(result.plan.summary.selectedSkillSources['python-patterns']).toMatch(/^ecc:/);
  expect(result.plan.summary.selectedSkillSources['database-migrations']).toMatch(/^ecc:/);
  expect(readLock(projectRoot).resolved.providers[0]?.packages.length).toBe(2);
});

test('auto-selection stays conservative and only picks skills that actually exist in scanned packages', () => {
  const projectRoot = makeTempDir('ai-tool-init-conservative-project-');
  const intakeRoot = makeTempDir('ai-tool-init-conservative-intake-');
  const partialPackage = makeTempDir('ai-tool-init-conservative-package-');

  createFakeSkillPackage(partialPackage, ['tdd-workflow', 'verification-loop', 'coding-standards', 'api-design']);

  fs.mkdirSync(path.join(intakeRoot, 'docs'), { recursive: true });
  fs.writeFileSync(
    path.join(intakeRoot, 'docs', 'requirements.md'),
    [
      '# Requirements',
      'Expose API schemas.',
      'Ship Postgres migrations.'
    ].join('\n'),
    'utf8'
  );

  const intakePath = writeIntakeManifest(intakeRoot, {
    version: 1,
    targetProjectPath: projectRoot,
    requestedOperation: 'auto',
    teamPackages: [{ providerId: 'ecc', rootPath: partialPackage, label: 'partial' }],
    documents: [
      {
        path: './docs/requirements.md',
        label: 'Requirements',
        kind: 'requirements',
        appliesTo: 'project'
      }
    ]
  });

  initProject({ projectRoot, intakePath });

  const teamSkills = readConfig(projectRoot).layers.team.providers[0]?.skills ?? [];
  expect(teamSkills).toEqual(expect.arrayContaining(['tdd-workflow', 'verification-loop', 'coding-standards', 'api-design']));
  expect(teamSkills.includes('database-migrations')).toBe(false);
});

test('claude native skill entrypoint shares the same project skill source as codex', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-shared-skills-');
  createFakeEccSource(eccRoot);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;

  initProject({ projectRoot, profileId: 'default' });

  const codexSkillPath = path.join(projectRoot, '.codex', 'skills', 'team-skill-evolution', 'SKILL.md');
  const claudeSkillsPath = path.join(projectRoot, '.claude', 'skills');
  expect(fs.readlinkSync(claudeSkillsPath)).toBe('../.codex/skills');
  expect(fs.readFileSync(path.join(claudeSkillsPath, 'team-skill-evolution', 'SKILL.md'), 'utf8')).toBe(
    fs.readFileSync(codexSkillPath, 'utf8')
  );
  expect(fs.readlinkSync(path.join(projectRoot, 'plugins', 'ai-tool-init-compat', 'skills'))).toBe('../../.codex/skills');
});

test('doctor reports package skill content drift and update refreshes the lock fingerprints', () => {
  const projectRoot = makeTempDir('ai-tool-init-package-drift-project-');
  const intakeRoot = makeTempDir('ai-tool-init-package-drift-intake-');
  const packageRoot = makeTempDir('ai-tool-init-package-drift-package-');

  createFakeSkillPackage(packageRoot, ['tdd-workflow', 'verification-loop', 'coding-standards']);

  const intakePath = writeIntakeManifest(intakeRoot, {
    version: 1,
    targetProjectPath: projectRoot,
    requestedOperation: 'auto',
    teamPackages: [{ providerId: 'ecc', rootPath: packageRoot, label: 'core' }]
  });

  initProject({ projectRoot, intakePath });
  const previousLock = readLock(projectRoot);
  fs.writeFileSync(path.join(packageRoot, 'skills', 'tdd-workflow', 'SKILL.md'), '# tdd-workflow\nupdated\n', 'utf8');

  const doctorBeforeUpdate = runDoctor({ projectRoot, intakePath });
  expect(doctorBeforeUpdate.ok).toBe(false);
  expect(doctorBeforeUpdate.errors.join('\n')).toMatch(/Provider package drift detected|Provider skill drift detected/);

  updateProject({ projectRoot, intakePath });
  const nextLock = readLock(projectRoot);
  expect(previousLock.resolved.providers[0]?.packages[0]?.fingerprint).not.toBe(nextLock.resolved.providers[0]?.packages[0]?.fingerprint);
  expect(runDoctor({ projectRoot, intakePath }).ok).toBe(true);
});

test('doctor reports deleted provider skills and plan schedules their removal from the project', () => {
  const projectRoot = makeTempDir('ai-tool-init-package-delete-project-');
  const intakeRoot = makeTempDir('ai-tool-init-package-delete-intake-');
  const packageRoot = makeTempDir('ai-tool-init-package-delete-package-');

  createFakeSkillPackage(packageRoot, ['tdd-workflow', 'verification-loop', 'coding-standards']);

  const intakePath = writeIntakeManifest(intakeRoot, {
    version: 1,
    targetProjectPath: projectRoot,
    requestedOperation: 'auto',
    teamPackages: [{ providerId: 'ecc', rootPath: packageRoot, label: 'core' }]
  });

  initProject({ projectRoot, intakePath });
  fs.rmSync(path.join(packageRoot, 'skills', 'verification-loop'), { recursive: true, force: true });

  const doctor = runDoctor({ projectRoot, intakePath });
  expect(doctor.ok).toBe(false);
  expect(doctor.errors.join('\n')).toMatch(/Provider skill missing/);

  const plan = createPlan({ command: 'update', projectRoot, intakePath });
  expect(plan.operations.some(item => item.action === 'delete' && item.path === '.agents/skills/verification-loop')).toBe(true);
});

test('update migrates legacy sourceRoot-only configs to package-based provider config without losing compatibility fields', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-source-root-migrate-');
  createFakeEccSource(eccRoot);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;

  initProject({ projectRoot, profileId: 'default' });
  const configPath = path.join(projectRoot, '.ai-tool-init', 'config.json');
  const config = readConfig(projectRoot);
  const provider = config.layers.team.providers[0];
  if (!provider) {
    throw new Error('Expected a provider to exist.');
  }
  provider.sourceRoot = eccRoot;
  delete provider.packages;
  writeJson(configPath, config);

  updateProject({ projectRoot });

  const migratedProvider = readConfig(projectRoot).layers.team.providers[0];
  expect(migratedProvider?.sourceRoot).toBe(eccRoot);
  expect(migratedProvider?.packages?.[0]?.rootPath).toBe(eccRoot);
});
