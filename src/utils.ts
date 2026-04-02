import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type {
  CurrentFingerprint,
  DesiredEntry,
  ManagedEntry,
  ManagedFingerprint
} from './types.js';

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function uniqueStrings(values: readonly string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).filter(Boolean)));
}

export function ensureDirForFile(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => variables[key] ?? '');
}

export function sha256(input: string | NodeJS.ArrayBufferView): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function isInside(basePath: string, candidatePath: string): boolean {
  const relative = path.relative(basePath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function getFileContentIfExists(filePath: string): string | null {
  try {
    if (fs.statSync(filePath).isFile()) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  return null;
}

export function getSymlinkTargetIfExists(filePath: string): string | null {
  try {
    if (fs.lstatSync(filePath).isSymbolicLink()) {
      return fs.readlinkSync(filePath);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  return null;
}

export function computeCurrentFingerprint(
  projectRoot: string,
  entry: Pick<ManagedEntry, 'path'>
): CurrentFingerprint | null {
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
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export function removePathIfExists(targetPath: string): void {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export function getManagedFingerprint(entry: DesiredEntry): ManagedFingerprint {
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

export function stableSortEntries<T extends { path: string }>(entries: readonly T[]): T[] {
  return [...entries].sort((left, right) => left.path.localeCompare(right.path));
}

export function listSkillDirectories(rootPath: string): string[] {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  return fs
    .readdirSync(rootPath)
    .filter(name => !name.startsWith('.'))
    .filter(name => fs.existsSync(path.join(rootPath, name, 'SKILL.md')))
    .sort();
}

export function maybeRealPath(targetPath: string): string | null {
  try {
    return fs.realpathSync.native(targetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}
