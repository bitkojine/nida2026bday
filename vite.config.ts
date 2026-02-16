import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';

interface BuildGitLargestFile {
  path: string;
  bytes: number;
}

interface BuildGitHistoryChurnEntry {
  path: string;
  totalBytes: number;
  blobCount: number;
}

interface BuildGitRepoStats {
  available: boolean;
  branch: string;
  commit: string;
  trackedFileCount: number;
  gitDirBytes: number;
  gitObjectCount: number | null;
  gitLooseSizeBytes: number | null;
  gitPackSizeBytes: number | null;
  largestTrackedFiles: BuildGitLargestFile[];
  historyChurn: BuildGitHistoryChurnEntry[];
  error?: string;
}

function getVilniusBuildStamp(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('lt-LT', {
    timeZone: 'Europe/Vilnius',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const pick = (type: string): string => parts.find((part) => part.type === type)?.value ?? '00';
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')}`;
}

function runGit(command: string): string {
  return execSync(command, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function getDirSizeBytes(path: string): number {
  let total = 0;
  const stack = [path];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    let entries: string[] = [];
    try {
      entries = readdirSync(current);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry);
      try {
        const st = statSync(full);
        if (st.isDirectory()) {
          stack.push(full);
        } else if (st.isFile()) {
          total += st.size;
        }
      } catch {
        // Best effort, skip unreadable entries.
      }
    }
  }
  return total;
}

function parseGitCountObjects(): {
  gitObjectCount: number | null;
  gitLooseSizeBytes: number | null;
  gitPackSizeBytes: number | null;
} {
  try {
    const raw = runGit('git count-objects -v');
    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes(':'));
    const map = new Map<string, string>();
    for (const line of lines) {
      const idx = line.indexOf(':');
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      map.set(key, value);
    }
    const looseCount = Number.parseInt(map.get('count') ?? '', 10);
    const inPackCount = Number.parseInt(map.get('in-pack') ?? '', 10);
    const looseKb = Number.parseFloat(map.get('size') ?? '');
    const packKb = Number.parseFloat(map.get('size-pack') ?? '');
    const objectCount =
      Number.isFinite(looseCount) && Number.isFinite(inPackCount) ? looseCount + inPackCount : null;
    return {
      gitObjectCount: objectCount,
      gitLooseSizeBytes: Number.isFinite(looseKb) ? Math.round(looseKb * 1024) : null,
      gitPackSizeBytes: Number.isFinite(packKb) ? Math.round(packKb * 1024) : null,
    };
  } catch {
    return {
      gitObjectCount: null,
      gitLooseSizeBytes: null,
      gitPackSizeBytes: null,
    };
  }
}

function getBuildGitRepoStats(): BuildGitRepoStats {
  try {
    const branch = runGit('git rev-parse --abbrev-ref HEAD');
    const commit = runGit('git rev-parse --short HEAD');
    const trackedFiles = runGit('git ls-files')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const largestTrackedFiles = trackedFiles
      .map((path) => {
        try {
          return { path, bytes: statSync(join(process.cwd(), path)).size };
        } catch {
          return { path, bytes: 0 };
        }
      })
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 4);

    const historyRaw = runGit(
      "git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectsize) %(rest)'",
    );
    const historyMap = new Map<string, { totalBytes: number; blobCount: number }>();
    for (const line of historyRaw.split('\n')) {
      const match = line.match(/^blob\s+(\d+)\s+(.+)$/);
      if (!match) {
        continue;
      }
      const size = Number.parseInt(match[1], 10);
      const path = match[2].trim();
      if (!path) {
        continue;
      }
      const prev = historyMap.get(path) ?? { totalBytes: 0, blobCount: 0 };
      prev.totalBytes += Number.isFinite(size) ? size : 0;
      prev.blobCount += 1;
      historyMap.set(path, prev);
    }
    const historyChurn = Array.from(historyMap.entries())
      .map(([path, values]) => ({ path, ...values }))
      .sort((a, b) => b.totalBytes - a.totalBytes)
      .slice(0, 3);

    const gitDirBytes = getDirSizeBytes(join(process.cwd(), '.git'));
    const objectStats = parseGitCountObjects();

    return {
      available: true,
      branch,
      commit,
      trackedFileCount: trackedFiles.length,
      gitDirBytes,
      gitObjectCount: objectStats.gitObjectCount,
      gitLooseSizeBytes: objectStats.gitLooseSizeBytes,
      gitPackSizeBytes: objectStats.gitPackSizeBytes,
      largestTrackedFiles,
      historyChurn,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'nežinoma klaida';
    return {
      available: false,
      branch: 'neprieinama',
      commit: 'neprieinama',
      trackedFileCount: 0,
      gitDirBytes: 0,
      gitObjectCount: null,
      gitLooseSizeBytes: null,
      gitPackSizeBytes: null,
      largestTrackedFiles: [],
      historyChurn: [],
      error: reason,
    };
  }
}

export default defineConfig({
  base: '/nida2026bday/',
  define: {
    __BUILD_VILNIUS_TIME__: JSON.stringify(getVilniusBuildStamp()),
    __GIT_REPO_STATS__: JSON.stringify(getBuildGitRepoStats()),
  },
  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'coverage/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/core/timingCalculator.ts',
        'src/core/scoreSystem.ts',
        'src/core/errorTranslator.ts',
        'src/core/inputController.ts',
        'src/core/dedicationBanner.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 90,
      },
    },
  },
});
