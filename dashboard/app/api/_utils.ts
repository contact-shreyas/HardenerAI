import path from 'path';
import { promises as fs } from 'fs';

export function isUiApplyEnabled(): boolean {
  return process.env.HARDENER_UI_APPLY === '1';
}

export const getWorkspaceRoot = (): string => {
  const envRoot = process.env.HARDENER_WORKSPACE;
  if (envRoot) return path.resolve(envRoot);
  return path.resolve(process.cwd(), '..');
};

export const safeResolve = (base: string, target: string): string => {
  const resolved = path.resolve(base, target);
  if (!resolved.startsWith(base)) {
    throw new Error('Invalid path resolution');
  }
  return resolved;
};

export const readJsonSafe = async <T>(filePath: string): Promise<T | null> => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
};
