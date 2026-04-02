import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { CurrentFingerprint, DesiredEntry, ManagedEntryV2 } from '../domain/contracts.js';

export function sha256(input: string | NodeJS.ArrayBufferView): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function ensureDirForFile(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
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

export function writeFileAtomic(filePath: string, content: string): void {
  ensureDirForFile(filePath);
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

export function writeJsonAtomic(filePath: string, value: unknown): void {
  writeFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function readTextIfExists(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  return null;
}

export function readSymlinkIfExists(filePath: string): string | null {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) {
      return fs.readlinkSync(filePath);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  return null;
}

export function computeCurrentFingerprint(projectRoot: string, entry: Pick<ManagedEntryV2, 'path'>): CurrentFingerprint | null {
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
    return { type: 'other' };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
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

export function uniqueStrings(values: readonly string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).filter(Boolean)));
}

export function stableSortEntries<T extends { path: string }>(entries: readonly T[]): T[] {
  return [...entries].sort((left, right) => left.path.localeCompare(right.path));
}

export function isInside(basePath: string, candidatePath: string): boolean {
  const relative = path.relative(basePath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function managedFingerprintFromDesired(entry: DesiredEntry): { type: 'file'; sha256: string } | { type: 'symlink'; symlinkTarget: string } {
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

export function summarizeSkill(content: string): string {
  const normalized = content
    .replace(/^---[\s\S]*?---\s*/m, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join(' ');
  return normalized.slice(0, 160);
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'package';
}
