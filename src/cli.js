#!/usr/bin/env node

const path = require('path');
const { explainDoctor, explainPlan, initProject, planProject, runDoctor, updateProject } = require('./index');

function usage() {
  return `
Usage:
  ai-tool-init plan --project <abs-path> [--profile default] [--json]
  ai-tool-init init --project <abs-path> [--profile default] [--force] [--json]
  ai-tool-init update --project <abs-path> [--force] [--json]
  ai-tool-init doctor --project <abs-path> [--profile default] [--json]
`;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = {
    command: args[0] || null,
    force: false,
    json: false,
    profileId: 'default',
    projectRoot: null
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--project') {
      parsed.projectRoot = args[index + 1] ? path.resolve(args[index + 1]) : null;
      index += 1;
    } else if (arg === '--profile') {
      parsed.profileId = args[index + 1] || 'default';
      index += 1;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--force') {
      parsed.force = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.command = 'help';
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function main() {
  try {
    const options = parseArgs(process.argv);

    if (!options.command || options.command === 'help') {
      process.stdout.write(usage());
      process.exit(0);
    }

    if (!options.projectRoot) {
      throw new Error('Missing required --project argument.');
    }

    if (options.command === 'plan') {
      const plan = planProject(options);
      if (options.json) {
        process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
      } else {
        process.stdout.write(`${explainPlan(plan)}\n`);
      }
      return;
    }

    if (options.command === 'init') {
      const result = initProject(options);
      if (options.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        process.stdout.write(`${explainPlan(result.plan)}\n`);
      }
      return;
    }

    if (options.command === 'update') {
      const result = updateProject(options);
      if (options.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        process.stdout.write(`${explainPlan(result.plan)}\n`);
      }
      return;
    }

    if (options.command === 'doctor') {
      const doctor = runDoctor(options);
      if (options.json) {
        process.stdout.write(`${JSON.stringify(doctor, null, 2)}\n`);
      } else {
        process.stdout.write(`${explainDoctor(doctor)}\n`);
      }
      process.exit(doctor.ok ? 0 : 1);
    }

    throw new Error(`Unknown command: ${options.command}`);
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n${usage()}`);
    process.exit(1);
  }
}

main();
