const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function renderTemplate(template, variables) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    if (!(key in variables)) {
      return '';
    }
    return String(variables[key]);
  });
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function toRepoPath(projectRoot, absolutePath) {
  const relative = path.relative(projectRoot, absolutePath);
  return relative.split(path.sep).join('/');
}

function isInside(basePath, candidatePath) {
  const relative = path.relative(basePath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function getFileContentIfExists(filePath) {
  try {
    if (fs.statSync(filePath).isFile()) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error;
    }
  }
  return null;
}

function getSymlinkTargetIfExists(filePath) {
  try {
    if (fs.lstatSync(filePath).isSymbolicLink()) {
      return fs.readlinkSync(filePath);
    }
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error;
    }
  }
  return null;
}

function computeCurrentFingerprint(projectRoot, entry) {
  const absolutePath = path.join(projectRoot, entry.path);
  try {
    const stat = fs.lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      return {
        type: 'symlink',
        symlinkTarget: fs.readlinkSync(absolutePath)
      };
    }
    if (stat.isFile()) {
      return {
        type: 'file',
        sha256: sha256(fs.readFileSync(absolutePath))
      };
    }
    return {
      type: 'other'
    };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function removePathIfExists(targetPath) {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error;
    }
  }
}

function getManagedFingerprint(entry) {
  if (entry.type === 'file') {
    return {
      type: 'file',
      sha256: sha256(entry.content)
    };
  }
  return {
    type: 'symlink',
    symlinkTarget: entry.target
  };
}

function stableSortEntries(entries) {
  return [...entries].sort((left, right) => left.path.localeCompare(right.path));
}

function listSkillDirectories(rootPath) {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  return fs.readdirSync(rootPath)
    .filter(name => !name.startsWith('.'))
    .filter(name => {
      const skillPath = path.join(rootPath, name, 'SKILL.md');
      return fs.existsSync(skillPath);
    })
    .sort();
}

function maybeRealPath(targetPath) {
  try {
    return fs.realpathSync.native(targetPath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

module.exports = {
  computeCurrentFingerprint,
  deepClone,
  ensureDir,
  ensureDirForFile,
  getFileContentIfExists,
  getManagedFingerprint,
  getSymlinkTargetIfExists,
  isInside,
  listSkillDirectories,
  maybeRealPath,
  readJson,
  removePathIfExists,
  renderTemplate,
  sha256,
  stableSortEntries,
  toRepoPath,
  uniqueStrings,
  writeJson
};
