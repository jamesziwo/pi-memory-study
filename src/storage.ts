import { readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface MemoryConfig {
  // 中文：总开关，可从任一作用域的 config.json 设置。
  /** Master switch, settable from config.json in either scope. */
  enabled: boolean;
  // 中文：每个作用域最多注入的 MEMORY.md 行数。
  /** Max lines of MEMORY.md injected per scope. */
  maxInjectLines: number;
  // 中文：每个作用域最多注入的 MEMORY.md 字节数。
  /** Max bytes of MEMORY.md injected per scope. */
  maxInjectBytes: number;
  // 中文：存在有效页表时，使用 ClawVM 风格常驻集合注入。
  /** Use ClawVM-style resident-set injection when a valid page table exists. */
  pageTableInjection: boolean;
  // 中文：选中页面表示的提示 token 预算。
  /** Prompt-token budget for selected page representations. */
  maxMemoryTokens: number;
  // 中文：以 JSONL 持久化常驻／写回决策和故障轨迹。
  /** Persist JSONL traces for residency/writeback decisions and faults. */
  traceEnabled: boolean;
  // 中文：拒绝不安全或破坏性写回操作，而非尽力尝试写入。
  /** Reject unsafe/destructive writeback operations instead of best-effort writing. */
  strictWriteback: boolean;
}

export const DEFAULT_CONFIG: MemoryConfig = {
  enabled: true,
  maxInjectLines: 200,
  maxInjectBytes: 8192,
  pageTableInjection: true,
  maxMemoryTokens: 4096,
  traceEnabled: true,
  strictWriteback: true,
};

// 中文：对 MEMORY.md 索引文件的一次有上限读取。
/** A capped read of a MEMORY.md index file. */
export interface IndexSnapshot {
  path: string;
  // 中文：内容不超过行数／字节上限，并在行边界截断。
  /** Content up to the line/byte caps, cut at line boundaries. */
  content: string;
  truncated: boolean;
  totalLines: number;
  totalBytes: number;
  injectedBytes: number;
}

export function globalMemoryDir(): string {
  return join(homedir(), ".pi", "agent", "memory");
}

export function projectMemoryDir(cwd: string): string {
  return join(cwd, ".pi", "memory");
}

// 中文：在 maxInjectLines 或 maxInjectBytes 任一先达到时限制内容，只在行边界截断，确保不拆开多字节字符。
/**
 * Cap content at whichever of maxInjectLines/maxInjectBytes is hit first,
 * cutting only at line boundaries so multi-byte characters are never split.
 */
export function capContent(
  raw: string,
  config: Pick<MemoryConfig, "maxInjectLines" | "maxInjectBytes">,
): { content: string; truncated: boolean } {
  const lines = raw.split("\n");
  const kept: string[] = [];
  let bytes = 0;
  for (const line of lines) {
    if (kept.length >= config.maxInjectLines) break;
    const lineBytes = Buffer.byteLength(line, "utf8") + (kept.length > 0 ? 1 : 0);
    if (bytes + lineBytes > config.maxInjectBytes) break;
    kept.push(line);
    bytes += lineBytes;
  }
  const truncated = kept.length < lines.length;
  return { content: kept.join("\n"), truncated };
}

interface CacheEntry {
  mtimeMs: number;
  size: number;
  maxInjectLines: number;
  maxInjectBytes: number;
  snapshot: IndexSnapshot;
}

export type IndexCache = Map<string, CacheEntry>;

export function createIndexCache(): IndexCache {
  return new Map();
}

// 中文：读取并截断 MEMORY.md 索引。文件不存在或不可读时返回 undefined；以 mtime+size 缓存结果，所以常见情况下每次提示只需 stat()。
/**
 * Read and cap a MEMORY.md index. Returns undefined when the file does not
 * exist (or is unreadable). Results are cached by mtime+size so the per-prompt
 * read is a stat() in the common case.
 */
export function readIndex(
  path: string,
  config: MemoryConfig,
  cache?: IndexCache,
): IndexSnapshot | undefined {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    cache?.delete(path);
    return undefined;
  }

  const cached = cache?.get(path);
  if (
    cached &&
    cached.mtimeMs === stat.mtimeMs &&
    cached.size === stat.size &&
    cached.maxInjectLines === config.maxInjectLines &&
    cached.maxInjectBytes === config.maxInjectBytes
  ) {
    return cached.snapshot;
  }

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    cache?.delete(path);
    return undefined;
  }

  const { content, truncated } = capContent(raw, config);
  const snapshot: IndexSnapshot = {
    path,
    content,
    truncated,
    totalLines: raw.length === 0 ? 0 : raw.split("\n").length,
    totalBytes: Buffer.byteLength(raw, "utf8"),
    injectedBytes: Buffer.byteLength(content, "utf8"),
  };
  cache?.set(path, {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    maxInjectLines: config.maxInjectLines,
    maxInjectBytes: config.maxInjectBytes,
    snapshot,
  });
  return snapshot;
}

// 中文：先加载全局目录 config.json，再加载项目目录（如果提供）；项目键覆盖全局键，与 pi 设置合并方式一致。缺失或无效文件忽略。
/**
 * Load config.json from the global dir, then the project dir (when given),
 * with project keys overriding global keys — mirroring pi's settings merge.
 * Missing or invalid files are ignored.
 */
export function loadConfig(globalDir: string, projectDir?: string): MemoryConfig {
  const config = { ...DEFAULT_CONFIG };
  for (const dir of [globalDir, projectDir]) {
    if (!dir) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(dir, "config.json"), "utf8"));
    } catch {
      continue;
    }
    if (typeof parsed !== "object" || parsed === null) continue;
    const candidate = parsed as Partial<MemoryConfig>;
    if (typeof candidate.enabled === "boolean") config.enabled = candidate.enabled;
    if (typeof candidate.maxInjectLines === "number" && candidate.maxInjectLines > 0) {
      config.maxInjectLines = candidate.maxInjectLines;
    }
    if (typeof candidate.maxInjectBytes === "number" && candidate.maxInjectBytes > 0) {
      config.maxInjectBytes = candidate.maxInjectBytes;
    }
    if (typeof candidate.pageTableInjection === "boolean") {
      config.pageTableInjection = candidate.pageTableInjection;
    }
    if (typeof candidate.maxMemoryTokens === "number" && candidate.maxMemoryTokens > 0) {
      config.maxMemoryTokens = candidate.maxMemoryTokens;
    }
    if (typeof candidate.traceEnabled === "boolean") config.traceEnabled = candidate.traceEnabled;
    if (typeof candidate.strictWriteback === "boolean") config.strictWriteback = candidate.strictWriteback;
  }
  return config;
}

export interface MemoryFile {
  name: string;
  bytes: number;
}

// 中文：列出记忆目录顶层 Markdown 文件，不包含 archive/。
/** List markdown files in a memory dir (top level; archive/ excluded). */
export function listMemoryFiles(dir: string): MemoryFile[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: MemoryFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    try {
      files.push({ name: entry.name, bytes: statSync(join(dir, entry.name)).size });
    } catch {
      // 中文：文件在 readdir 与 stat 之间消失，跳过。
      // file vanished between readdir and stat; skip
    }
  }
  return files.sort((a, b) => {
    if (a.name === "MEMORY.md") return -1;
    if (b.name === "MEMORY.md") return 1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
}
