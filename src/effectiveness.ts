import type { MemoryFault } from "./memory-domain.ts";
import type { ResidencyDecision } from "./residency.ts";

export interface MemoryEffectivenessExpectations {
  // 中文：任务正确使用记忆所必需的常驻页面。
  /** Pages that must be resident for the task to use memory correctly. */
  neededPageIds?: Iterable<string>;
  // 中文：选中后其 token 可计为有效记忆上下文的页面。
  /** Pages whose selected tokens count as useful memory context. */
  relevantPageIds?: Iterable<string>;
  // 中文：预期在饱和压力下仍应保留的硬固定或活跃固定页面。
  /** Hard or active pages expected to survive saturation pressure. */
  pinnedPageIds?: Iterable<string>;
  // 中文：不变量页面所需的最低保真度 token 总量。
  /** Total minimum-fidelity tokens required by invariant pages. */
  minimumRequiredTokens?: number;
}

export interface MemoryEffectivenessMetrics {
  selectedPageCount: number;
  selectedTokenCount: number;
  neededRecallRate: number | undefined;
  pinnedSurvivalRate: number | undefined;
  usefulMemoryTokenRatio: number | undefined;
  saturationRatio: number | undefined;
  policyControllableFaultCount: number;
  policyControllableFaults: MemoryFault[];
}

const POLICY_CONTROLLABLE_FAULTS = new Set<MemoryFault["type"]>([
  "pinned_invariant_miss",
  "post_compaction_bootstrap_loss",
  "flush_miss",
  "silent_recall",
  "writeback_rejected",
  "sidecar_corrupt",
  "duplicate_tool_signature",
  "refetch",
  "invariant_pressure",
]);

// 中文：使用与智能体黑盒评估相同的高层类别——利用率、饱和度和错误——为确定性的记忆策略决策评分。这使测试保持精简，也为后续智能体提供可在回放夹具中复用的稳定指标名称。
/**
 * Score a deterministic memory-policy decision using the same high-level
 * categories we use for black-box agent evaluation: utilization, saturation,
 * and errors. This keeps tests small and gives future agents stable metric
 * names to reuse in replay fixtures.
 */
export function scoreResidencyDecision(
  decision: ResidencyDecision,
  expectations: MemoryEffectivenessExpectations = {},
): MemoryEffectivenessMetrics {
  const selectedIds = new Set(decision.selected.map((resident) => resident.page.id));
  const neededIds = asSet(expectations.neededPageIds);
  const relevantIds = asSet(expectations.relevantPageIds);
  const pinnedIds = asSet(expectations.pinnedPageIds);
  const policyControllableFaults = decision.faults.filter((fault) =>
    POLICY_CONTROLLABLE_FAULTS.has(fault.type),
  );

  return {
    selectedPageCount: decision.selected.length,
    selectedTokenCount: decision.usedTokens,
    neededRecallRate: rate(neededIds, (id) => selectedIds.has(id)),
    pinnedSurvivalRate: rate(pinnedIds, (id) => selectedIds.has(id)),
    usefulMemoryTokenRatio: usefulTokenRatio(decision, relevantIds),
    saturationRatio: expectations.minimumRequiredTokens === undefined
      ? undefined
      : safeRatio(expectations.minimumRequiredTokens, decision.budgetTokens),
    policyControllableFaultCount: policyControllableFaults.length,
    policyControllableFaults,
  };
}

function usefulTokenRatio(decision: ResidencyDecision, relevantIds: Set<string>): number | undefined {
  if (relevantIds.size === 0 || decision.usedTokens === 0) return undefined;
  let usefulTokens = 0;
  for (const resident of decision.selected) {
    if (relevantIds.has(resident.page.id)) usefulTokens += resident.representation.tokenEstimate;
  }
  return safeRatio(usefulTokens, decision.usedTokens);
}

function rate(ids: Set<string>, predicate: (id: string) => boolean): number | undefined {
  if (ids.size === 0) return undefined;
  let hits = 0;
  for (const id of ids) {
    if (predicate(id)) hits += 1;
  }
  return hits / ids.size;
}

function safeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return numerator === 0 ? 1 : Number.POSITIVE_INFINITY;
  return numerator / denominator;
}

function asSet(values: Iterable<string> | undefined): Set<string> {
  return new Set(values ?? []);
}
