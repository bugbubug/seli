const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  createPlan,
  initProject,
  planProject,
  runDoctor,
  updateProject
} = require('../src');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createFakeEccSource(rootPath) {
  const skills = [
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
  ];

  for (const skill of skills) {
    const skillPath = path.join(rootPath, 'skills', skill);
    fs.mkdirSync(skillPath, { recursive: true });
    fs.writeFileSync(path.join(skillPath, 'SKILL.md'), `# ${skill}\n`, 'utf8');
  }
}

function createLegacyPolymarketProject(projectRoot, eccRoot) {
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
    plugins: [
      {
        name: 'ai-tool-init-compat'
      }
    ]
  });
  writeJson(path.join(projectRoot, 'plugins', 'ai-tool-init-compat', '.codex-plugin', 'plugin.json'), {
    name: 'ai-tool-init-compat'
  });
  fs.writeFileSync(
    path.join(projectRoot, '.codex', 'agents', 'explorer.toml'),
    'name = "explorer"\n',
    'utf8'
  );
}

function createLegacyUnifiedProject(projectRoot, eccRoot) {
  fs.mkdirSync(path.join(projectRoot, '.codex', 'skills', 'risk-audit'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, '.codex', 'agents'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, '.agents', 'skills'), { recursive: true });

  fs.writeFileSync(
    path.join(projectRoot, '.codex', 'skills', 'risk-audit', 'SKILL.md'),
    '# risk-audit\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(projectRoot, '.codex', 'agents', 'reviewer.toml'),
    'name = "reviewer"\n',
    'utf8'
  );
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

  assert.equal(fs.existsSync(path.join(projectRoot, '.ai-tool-init', 'config.json')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, '.ai-tool-init', 'lock.json')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, 'AGENTS.md')), true);
  assert.equal(fs.lstatSync(path.join(projectRoot, 'CLAUDE.md')).isSymbolicLink(), true);
  assert.equal(fs.existsSync(path.join(projectRoot, '.codex', 'config.toml')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, '.claude', 'README.md')), true);
  assert.equal(fs.lstatSync(path.join(projectRoot, '.agents', 'skills', 'tdd-workflow')).isSymbolicLink(), true);
  assert.equal(
    fs.existsSync(path.join(projectRoot, 'plugins', 'ai-tool-init-compat', '.codex-plugin', 'plugin.json')),
    true
  );
});

test('update bootstraps a legacy polymarket-style repository without a manifest', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-polymarket-');
  createFakeEccSource(eccRoot);
  createLegacyPolymarketProject(projectRoot, eccRoot);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;

  updateProject({ projectRoot });

  const config = JSON.parse(fs.readFileSync(path.join(projectRoot, '.ai-tool-init', 'config.json'), 'utf8'));
  assert.equal(config.layers.project.compatPlugin.enabled, true);
  assert.deepEqual(config.layers.team.providers[0].skills, ['tdd-workflow', 'verification-loop']);
  assert.equal(fs.existsSync(path.join(projectRoot, '.codex', 'config.toml')), true);
});

test('update bootstraps a legacy unified-pay style repository and preserves detected project skills as external', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-unified-');
  createFakeEccSource(eccRoot);
  createLegacyUnifiedProject(projectRoot, eccRoot);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;

  updateProject({ projectRoot });

  const config = JSON.parse(fs.readFileSync(path.join(projectRoot, '.ai-tool-init', 'config.json'), 'utf8'));
  assert.equal(config.layers.project.skills[0].id, 'risk-audit');
  assert.equal(config.layers.project.skills[0].managed, false);
  assert.equal(fs.readFileSync(path.join(projectRoot, '.codex', 'skills', 'risk-audit', 'SKILL.md'), 'utf8'), '# risk-audit\n');
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
  assert.deepEqual(applyKeys, operationKeys);

  const followUpPlan = createPlan({ command: 'update', projectRoot });
  assert.equal(followUpPlan.operations.length, 0);
});

test('doctor reports missing provider roots after the external team source disappears', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-doctor-');
  createFakeEccSource(eccRoot);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;

  initProject({ projectRoot, profileId: 'default' });
  fs.rmSync(eccRoot, { recursive: true, force: true });

  const doctor = runDoctor({ projectRoot });
  assert.equal(doctor.ok, false);
  assert.match(doctor.errors.join('\n'), /Provider source root missing/);
});

test('project built-in skills override team skills with the same id', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-collision-');
  createFakeEccSource(eccRoot);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;

  initProject({ projectRoot, profileId: 'default' });
  const configPath = path.join(projectRoot, '.ai-tool-init', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.layers.project.skills.push({
    id: 'backend-patterns',
    description: 'Project override of backend-patterns.',
    managed: true
  });
  writeJson(configPath, config);

  updateProject({ projectRoot });
  const plan = createPlan({ command: 'plan', projectRoot });
  assert.equal(fs.existsSync(path.join(projectRoot, '.codex', 'skills', 'backend-patterns', 'SKILL.md')), true);
  assert.equal(fs.lstatSync(path.join(projectRoot, '.agents', 'skills', 'backend-patterns')).isSymbolicLink(), true);
  assert.deepEqual(plan.summary.collisions, ['backend-patterns']);
});

test('compat plugin files are removed when compat is disabled in the manifest', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-compat-');
  createFakeEccSource(eccRoot);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;

  initProject({ projectRoot, profileId: 'default' });
  const configPath = path.join(projectRoot, '.ai-tool-init', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.layers.project.compatPlugin.enabled = false;
  writeJson(configPath, config);

  updateProject({ projectRoot });

  assert.equal(fs.existsSync(path.join(projectRoot, '.agents', 'plugins', 'marketplace.json')), false);
  assert.equal(
    fs.existsSync(path.join(projectRoot, 'plugins', 'ai-tool-init-compat', '.codex-plugin', 'plugin.json')),
    false
  );
});

test('managed drift blocks update by default and force rebuild restores generated files', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-drift-');
  createFakeEccSource(eccRoot);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;

  initProject({ projectRoot, profileId: 'default' });
  fs.appendFileSync(path.join(projectRoot, 'AGENTS.md'), '\nuser drift\n', 'utf8');

  assert.throws(
    () => updateProject({ projectRoot }),
    error => error && error.code === 'MANAGED_DRIFT'
  );

  updateProject({ projectRoot, force: true });
  const agents = fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8');
  assert.equal(agents.includes('user drift'), false);
});

test('cli plan json does not write to HOME and exposes the same operation set as apply', () => {
  const eccRoot = makeTempDir('ai-tool-init-ecc-');
  const projectRoot = makeTempDir('ai-tool-init-cli-');
  const homeRoot = makeTempDir('ai-tool-init-home-');
  createFakeEccSource(eccRoot);

  const cliPath = path.join(__dirname, '..', 'src', 'cli.js');
  const planJson = execFileSync(
    process.execPath,
    [cliPath, 'plan', '--project', projectRoot, '--profile', 'default', '--json'],
    {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        AI_TOOL_INIT_ECC_ROOT: eccRoot,
        HOME: homeRoot
      },
      encoding: 'utf8'
    }
  );
  const plan = JSON.parse(planJson);
  process.env.AI_TOOL_INIT_ECC_ROOT = eccRoot;
  const initResult = initProject({ projectRoot, profileId: 'default' });

  assert.deepEqual(
    initResult.plan.operations.map(item => `${item.action}:${item.path}`),
    plan.operations.map(item => `${item.action}:${item.path}`)
  );
  assert.equal(fs.existsSync(path.join(homeRoot, '.codex')), false);
  assert.equal(fs.existsSync(path.join(homeRoot, '.claude')), false);
});
