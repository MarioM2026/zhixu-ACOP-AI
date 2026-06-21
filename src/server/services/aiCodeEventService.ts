import { v4 as uuidv4 } from 'uuid';
import type { AICodeEvent, ApiResponse } from '@zhixu/shared/types';
import { logger } from './logger';
import { loadJSON, schedulePersist, saveJSON } from './storageService';

const STORAGE_KEY = 'ai-code-events';

/** 内存中保留的最大事件数（超过后自动清理最老的事件）*/
const MAX_EVENTS_IN_MEMORY = 5000;

/** 事件数据保留天数（超过此天数的事件会被归档/清理）*/
const RETENTION_DAYS = 30;

const events: Map<string, AICodeEvent> = new Map();

/** 真实数据标记：是否包含从 Trae/Cursor/Claude 等适配器采集到的真实事件 */
let hasRealData: boolean = false;

/** 从持久化加载。若持久化文件为空 → 空数据等待采集；有数据 → 使用真实数据 */
export async function loadFromStorage(): Promise<void> {
  const saved = await loadJSON<AICodeEvent[]>(STORAGE_KEY, []);
  events.clear();

  // 数据保留策略：只加载最近 RETENTION_DAYS 天内的数据
  const cutoffTime = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let loaded = 0;
  let dropped = 0;

  for (const event of saved) {
    if (event.timestamp && event.timestamp >= cutoffTime) {
      events.set(event.id || uuidv4(), event);
      loaded++;
    } else {
      dropped++;
    }
  }

  // 内存上限保护：如果超过 MAX_EVENTS_IN_MEMORY，保留最新的事件
  if (events.size > MAX_EVENTS_IN_MEMORY) {
    const sorted = Array.from(events.values()).sort((a, b) => b.timestamp - a.timestamp);
    const toRemove = sorted.slice(MAX_EVENTS_IN_MEMORY);
    toRemove.forEach((e) => events.delete(e.id));
    dropped += toRemove.length;
    logger.info(`[Events] 内存保护：保留最近 ${MAX_EVENTS_IN_MEMORY} 条事件，丢弃 ${toRemove.length} 条超上限事件`);
  }

  if (loaded > 0) {
    hasRealData = true;
    logger.info(`[Events] 从持久化加载 ${loaded} 条事件（真实数据）` + (dropped > 0 ? `，丢弃 ${dropped} 条超期事件` : ''));
  } else {
    hasRealData = false;
    logger.info(`[Events] 无历史数据，等待适配器采集真实 AI 使用事件...`);
  }
}

function persist(): void {
  schedulePersist(STORAGE_KEY, () => Array.from(events.values()));
}

/** 重置事件：清空所有数据。返回 0 */
export async function resetEventsToSample(): Promise<number> {
  events.clear();
  hasRealData = false;
  await saveJSON(STORAGE_KEY, []);
  logger.info('[Events] 已清空所有事件（真实数据模式：不注入演示数据）');
  return 0;
}

/** 清空所有事件。返回 0 */
export async function clearAllEvents(): Promise<number> {
  events.clear();
  hasRealData = false;
  await saveJSON(STORAGE_KEY, []);
  logger.info('[Events] 已清空所有事件');
  return 0;
}

/** 是否有真实数据（非模拟 seed 数据） */
export function hasRealEvents(): boolean {
  return hasRealData;
}

/** 获取指定时间范围内的事件 */
export async function getEventsInTimeRange(startTime: number, endTime: number): Promise<AICodeEvent[]> {
  const allEvents = Array.from(events.values());
  return allEvents.filter((e) => e.timestamp >= startTime && e.timestamp <= endTime);
}

/** 获取指定时间范围内的汇总统计（供仪表盘使用） */
export async function getAggregatedStats(params: { days?: number; startDate?: string; endDate?: string }): Promise<{
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  totalLatency: number;
  errorCount: number;
  byTool: Record<string, { requestCount: number; totalTokens: number; totalLatency: number; errorCount: number }>;
  byDate: Record<string, { inputTokens: number; outputTokens: number; totalTokens: number }>;
  errorDistribution: Record<string, number>;
  sessionCount: number;
  modelUsage: Record<string, number>;
}> {
  const now = Date.now();
  const days = params.days || 7;
  const endTime = params.endDate ? new Date(params.endDate).getTime() : now;
  const startTime = params.startDate ? new Date(params.startDate).getTime() : now - days * 24 * 60 * 60 * 1000;

  const inRange = Array.from(events.values()).filter((e) => e.timestamp >= startTime && e.timestamp <= endTime);

  const result = {
    totalTokens: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalRequests: inRange.length,
    totalLatency: 0,
    errorCount: 0,
    byTool: {} as Record<string, { requestCount: number; totalTokens: number; totalLatency: number; errorCount: number }>,
    byDate: {} as Record<string, { inputTokens: number; outputTokens: number; totalTokens: number }>,
    errorDistribution: {} as Record<string, number>,
    sessionCount: new Set(inRange.map((e) => e.sessionId)).size,
    modelUsage: {} as Record<string, number>,
  };

  for (const event of inRange) {
    const input = event.tokenConsumption?.input || 0;
    const output = event.tokenConsumption?.output || 0;
    const total = input + output;
    const latency = event.performance?.latency || 0;
    const hasError = !!event.quality?.errorType;

    result.totalInputTokens += input;
    result.totalOutputTokens += output;
    result.totalTokens += total;
    result.totalLatency += latency;
    if (hasError) result.errorCount++;

    // 按工具聚合
    const toolKey = event.tool || 'unknown';
    if (!result.byTool[toolKey]) {
      result.byTool[toolKey] = { requestCount: 0, totalTokens: 0, totalLatency: 0, errorCount: 0 };
    }
    result.byTool[toolKey].requestCount++;
    result.byTool[toolKey].totalTokens += total;
    result.byTool[toolKey].totalLatency += latency;
    if (hasError) result.byTool[toolKey].errorCount++;

    // 按日期聚合（用于 Token 趋势）
    const dateStr = new Date(event.timestamp).toISOString().split('T')[0];
    if (!result.byDate[dateStr]) {
      result.byDate[dateStr] = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    }
    result.byDate[dateStr].inputTokens += input;
    result.byDate[dateStr].outputTokens += output;
    result.byDate[dateStr].totalTokens += total;

    // 错误类型分布
    if (hasError) {
      const errType = event.quality?.errorType || 'unknown';
      result.errorDistribution[errType] = (result.errorDistribution[errType] || 0) + 1;
    }

    // 模型使用
    if (event.modelId) {
      result.modelUsage[event.modelId] = (result.modelUsage[event.modelId] || 0) + 1;
    }
  }

  return result;
}

/** 清理超过 RETENTION_DAYS 的老事件（可定期调用） */
export async function cleanupOldEvents(): Promise<{ removed: number; remaining: number }> {
  const cutoffTime = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const [id, event] of events.entries()) {
    if (event.timestamp < cutoffTime) {
      events.delete(id);
      removed++;
    }
  }
  if (removed > 0) {
    persist();
    logger.info(`[Events] 清理 ${removed} 条超期事件，剩余 ${events.size} 条`);
  }
  return { removed, remaining: events.size };
}

// 记录 AI 代码事件（带 token 安全校验：避免解析错误导致的万亿级 token 数据）
export async function recordAICodeEvent(event: AICodeEvent): Promise<AICodeEvent> {
  const TOKEN_LIMIT = 2000000; // 200 万，超过此值视为解析错误
  const LATENCY_LIMIT = 10 * 60 * 1000; // 10 分钟

  // Token 清理：限制上限，非正数归零
  const inputTokens = event.tokenConsumption?.input
    ? Math.min(TOKEN_LIMIT, Math.max(0, event.tokenConsumption.input))
    : 0;
  const outputTokens = event.tokenConsumption?.output
    ? Math.min(TOKEN_LIMIT, Math.max(0, event.tokenConsumption.output))
    : 0;

  // 延迟清理：限制上限，非正数归零
  const latency = event.performance?.latency
    ? Math.min(LATENCY_LIMIT, Math.max(0, event.performance.latency))
    : 0;
  const ttft = event.performance?.ttft
    ? Math.min(LATENCY_LIMIT, Math.max(0, event.performance.ttft))
    : 0;

  const hasTokenAnomaly =
    (event.tokenConsumption?.input || 0) > TOKEN_LIMIT ||
    (event.tokenConsumption?.output || 0) > TOKEN_LIMIT;

  const id = event.id || uuidv4();
  const newEvent: AICodeEvent = {
    ...event,
    id,
    traceId: event.traceId || uuidv4(),
    timestamp: event.timestamp || Date.now(),
    tokenConsumption: {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
    },
    performance: {
      latency,
      ttft,
    },
  };

  // 当接收到真实事件时，标记为真实数据模式
  hasRealData = true;

  events.set(id, newEvent);

  // 内存上限保护：如果事件数超过 MAX_EVENTS_IN_MEMORY，删除最老的事件
  if (events.size > MAX_EVENTS_IN_MEMORY) {
    const sorted = Array.from(events.values()).sort((a, b) => b.timestamp - a.timestamp);
    const toRemove = sorted.slice(MAX_EVENTS_IN_MEMORY);
    const removedCount = toRemove.length;
    toRemove.forEach((e) => events.delete(e.id));
    logger.info(`[Events] 内存保护：删除 ${removedCount} 条最老事件，保留 ${MAX_EVENTS_IN_MEMORY} 条`);
  }

  if (hasTokenAnomaly) {
    logger.warn(`Token 异常已被修正`, {
      id,
      originalInput: event.tokenConsumption?.input,
      originalOutput: event.tokenConsumption?.output,
      sanitizedInput: inputTokens,
      sanitizedOutput: outputTokens,
    });
  } else {
    logger.info(`Recorded AI code event: ${id}`, { tool: event.tool, sessionId: event.sessionId });
  }
  persist();

  return newEvent;
}

// 获取事件列表（带分页）
export async function getEvents(params: {
  page: number;
  pageSize: number;
  tool?: string;
  startTime?: number;
  endTime?: number;
}): Promise<{ data: AICodeEvent[]; pagination: { page: number; pageSize: number; total: number } }> {
  let filteredEvents = Array.from(events.values());

  // 按工具类型过滤
  if (params.tool) {
    filteredEvents = filteredEvents.filter((e) => e.tool === params.tool);
  }

  // 按时间范围过滤
  if (params.startTime) {
    filteredEvents = filteredEvents.filter((e) => e.timestamp >= params.startTime!);
  }
  if (params.endTime) {
    filteredEvents = filteredEvents.filter((e) => e.timestamp <= params.endTime!);
  }

  // 按时间倒序
  filteredEvents.sort((a, b) => b.timestamp - a.timestamp);

  // 分页
  const total = filteredEvents.length;
  const start = (params.page - 1) * params.pageSize;
  const end = start + params.pageSize;
  const paginatedEvents = filteredEvents.slice(start, end);

  return {
    data: paginatedEvents,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
    },
  };
}

// 获取单个事件
export async function getEventById(id: string): Promise<AICodeEvent | null> {
  return events.get(id) || null;
}

// 获取事件统计
export async function getEventStats(): Promise<{
  total: number;
  byTool: Record<string, number>;
}> {
  const allEvents = Array.from(events.values());
  const byTool: Record<string, number> = {};

  for (const event of allEvents) {
    byTool[event.tool] = (byTool[event.tool] || 0) + 1;
  }

  return {
    total: allEvents.length,
    byTool,
  };
}

// 获取最近的事件（用于规则引擎评估）
export async function getRecentEvents(limit: number = 100): Promise<AICodeEvent[]> {
  const allEvents = Array.from(events.values());
  return allEvents
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

// 获取所有事件（用于上下文管理分析）
export async function getAllEvents(): Promise<AICodeEvent[]> {
  return Array.from(events.values());
}
