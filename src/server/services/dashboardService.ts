import type {
  DashboardStats,
  TokenTrend,
  ErrorDistribution,
  ToolUsageStats,
  Session,
  Alert,
  Rule,
  AICodeEvent,
} from '@zhixu/shared/types';
import { logger } from './logger';
import { getAlerts, getRules } from './ruleService';
import { routerService } from './routerService';
import { getAggregatedStats, getAllEvents, hasRealEvents } from './aiCodeEventService';
import type { RoutingStats } from '@zhixu/shared/types';

export interface RouterStats {
  totalDecisions: number;
  activeModels: number;
  topModel: string;
  topStrategy: string;
  taskTypeDistribution: Record<string, number>;
  strategyUsage: Record<string, number>;
  modelUsage: Record<string, number>;
}

/** 中文错误类型映射 */
const ERROR_TYPE_NAMES: Record<string, string> = {
  timeout: '接口超时',
  invalid_response: '响应格式异常',
  context_overflow: '上下文溢出',
  rate_limit: '触发限流',
  auth_failed: '认证失败',
  unknown: '未知错误',
  '': '未分类',
};

// 基于真实事件的 Token 趋势数据
function buildTokenTrendFromEvents(
  byDate: Record<string, { inputTokens: number; outputTokens: number; totalTokens: number }>,
  startDate: Date,
  endDate: Date
): TokenTrend[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const result: TokenTrend[] = [];
  const start = new Date(startDate.toISOString().split('T')[0]);
  const end = new Date(endDate.toISOString().split('T')[0]);
  const current = new Date(start.getTime());

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const dayData = byDate[dateStr];
    result.push({
      date: dateStr,
      inputTokens: dayData?.inputTokens || 0,
      outputTokens: dayData?.outputTokens || 0,
      totalTokens: dayData?.totalTokens || 0,
    });
    current.setTime(current.getTime() + dayMs);
  }

  return result;
}

// 基于真实事件的错误分布
function buildErrorDistributionFromEvents(
  errorDist: Record<string, number>,
  totalRequests: number
): ErrorDistribution[] {
  if (totalRequests === 0) return [];

  const entries = Object.entries(errorDist);
  if (entries.length === 0) return [];

  const result: ErrorDistribution[] = entries.map(([errType, count]) => {
    const displayName = ERROR_TYPE_NAMES[errType] || errType;
    return {
      errorType: displayName,
      count,
      percentage: Number(((count / totalRequests) * 100).toFixed(1)),
    };
  });

  // 按 count 降序排列
  result.sort((a, b) => b.count - a.count);
  return result;
}

// 基于真实事件的工具使用统计
function buildToolUsageFromEvents(
  byTool: Record<string, { requestCount: number; totalTokens: number; totalLatency: number; errorCount: number }>
): ToolUsageStats[] {
  const tools = Object.keys(byTool);
  if (tools.length === 0) return [];

  const result: ToolUsageStats[] = tools.map((tool) => {
    const data = byTool[tool];
    const avgLatency = data.requestCount > 0 ? Math.round(data.totalLatency / data.requestCount) : 0;
    const errorRate = data.requestCount > 0 ? Number(((data.errorCount / data.requestCount) * 100).toFixed(2)) : 0;

    return {
      tool,
      requestCount: data.requestCount,
      totalTokens: data.totalTokens,
      avgLatency,
      errorRate,
    };
  });

  // 按 requestCount 降序排列
  result.sort((a, b) => b.requestCount - a.requestCount);
  return result;
}

// 从真实事件中提取会话统计
function buildSessionsFromEvents(limit: number): Session[] {
  // 由于我们通过全局聚合获取数据，这里直接从事件中反推 session 列表
  return []; // 当前暂不支持详细会话列表，可后续扩展
}

// 解析查询参数，返回 { days, startDate, endDate }
// 同时支持数字形式（days）和 query 对象
function parseTimeRangeQuery(query: number | string | {
  days?: string;
  startDate?: string;
  endDate?: string;
} = {}) {
  let days = 7;
  let startDate: Date;
  let endDate: Date;
  const now = new Date();
  endDate = new Date(now.toISOString().split('T')[0]);

  // 数字或纯字符串形式：days
  if (typeof query === 'number') {
    days = query;
    const dayMs = 24 * 60 * 60 * 1000;
    startDate = new Date(endDate.getTime() - (days - 1) * dayMs);
    return { days, startDate, endDate };
  }
  if (typeof query === 'string') {
    days = Number(query) || 7;
    const dayMs = 24 * 60 * 60 * 1000;
    startDate = new Date(endDate.getTime() - (days - 1) * dayMs);
    return { days, startDate, endDate };
  }

  // query 对象形式
  if (query.startDate && query.endDate) {
    startDate = new Date(query.startDate);
    endDate = new Date(query.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      startDate = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);
    }
    if (startDate > endDate) {
      const tmp = startDate;
      startDate = endDate;
      endDate = tmp;
    }
    const dayMs = 24 * 60 * 60 * 1000;
    days = Math.round((endDate.getTime() - startDate.getTime()) / dayMs) + 1;
  } else if (query.days) {
    days = Number(query.days) || 7;
    const dayMs = 24 * 60 * 60 * 1000;
    startDate = new Date(endDate.getTime() - (days - 1) * dayMs);
  } else {
    const dayMs = 24 * 60 * 60 * 1000;
    startDate = new Date(endDate.getTime() - (days - 1) * dayMs);
  }

  return { days, startDate, endDate };
}

// 获取仪表盘统计数据（从真实事件聚合）
export async function getDashboardStats(
  query?: number | string | { days?: string; startDate?: string; endDate?: string }
): Promise<DashboardStats> {
  const { days, startDate, endDate } = parseTimeRangeQuery(query ?? {});

  const stats = await getAggregatedStats({
    days,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  });

  const avgLatency = stats.totalRequests > 0 ? Math.round(stats.totalLatency / stats.totalRequests) : 0;
  const errorRate = stats.totalRequests > 0 ? Number(((stats.errorCount / stats.totalRequests) * 100).toFixed(2)) : 0;
  const totalCost = Number((stats.totalTokens * 0.00001).toFixed(2));

  return {
    totalTokens: stats.totalTokens,
    totalRequests: stats.totalRequests,
    avgLatency,
    errorRate,
    totalCost,
    activeSessions: stats.sessionCount,
  };
}

// 获取 Token 消耗趋势（从真实事件聚合）
export async function getTokenTrend(
  query?: number | string | { days?: string; startDate?: string; endDate?: string }
): Promise<TokenTrend[]> {
  const { days, startDate, endDate } = parseTimeRangeQuery(query ?? {});

  const stats = await getAggregatedStats({
    days,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  });

  return buildTokenTrendFromEvents(stats.byDate, startDate, endDate);
}

// 获取错误分布（从真实事件聚合）
export async function getErrorDistribution(
  query?: number | string | { days?: string; startDate?: string; endDate?: string }
): Promise<ErrorDistribution[]> {
  const { days, startDate, endDate } = parseTimeRangeQuery(query ?? {});

  const stats = await getAggregatedStats({
    days,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  });

  return buildErrorDistributionFromEvents(stats.errorDistribution, stats.totalRequests);
}

// 获取工具使用统计（从真实事件聚合）
export async function getToolUsageStats(
  query?: number | string | { days?: string; startDate?: string; endDate?: string }
): Promise<ToolUsageStats[]> {
  const { days, startDate, endDate } = parseTimeRangeQuery(query ?? {});

  const stats = await getAggregatedStats({
    days,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  });

  return buildToolUsageFromEvents(stats.byTool);
}

// 获取最近会话（从真实事件反推）
export async function getRecentSessions(limit: number = 10): Promise<Session[]> {
  const events = await getAllEvents();
  if (events.length === 0) return [];

  // 按 sessionId 聚合，找到每个 session 的最新事件时间
  const sessionMap = new Map<
    string,
    { sessionId: string; startTime: number; lastEventTime: number; eventCount: number; tool: string; totalTokens: number }
  >();

  for (const event of events) {
    const key = event.sessionId || 'unknown';
    const existing = sessionMap.get(key);
    if (!existing) {
      sessionMap.set(key, {
        sessionId: key,
        startTime: event.timestamp,
        lastEventTime: event.timestamp,
        eventCount: 1,
        tool: event.tool || 'unknown',
        totalTokens: event.tokenConsumption?.total || 0,
      });
    } else {
      existing.startTime = Math.min(existing.startTime, event.timestamp);
      existing.lastEventTime = Math.max(existing.lastEventTime, event.timestamp);
      existing.eventCount++;
      existing.totalTokens += event.tokenConsumption?.total || 0;
    }
  }

  // 按最后事件时间降序排列，取最近 limit 个
  const sessions = Array.from(sessionMap.values())
    .sort((a, b) => b.lastEventTime - a.lastEventTime)
    .slice(0, limit)
    .map((s) => ({
      sessionId: s.sessionId,
      startTime: s.startTime,
      lastEventTime: s.lastEventTime,
      eventCount: s.eventCount,
      tool: s.tool,
      totalTokens: s.totalTokens,
    })) as unknown as Session[];

  return sessions;
}

// 检查是否有真实数据（供前端展示用）
export function hasAnyRealData(): boolean {
  return hasRealEvents();
}

// 初始化（保留空函数以兼容已有调用）
export function initDashboardSamples() {
  logger.info('[dashboardService] 已切换为真实事件聚合模式');
}

/** 告警趋势数据（按天统计） */
export interface AlertTrend {
  date: string;
  critical: number;
  warning: number;
  info: number;
  total: number;
}

/** 告警统计摘要 */
export interface AlertStats {
  total: number;
  critical: number;
  warning: number;
  info: number;
  acknowledged: number;
  unacknowledged: number;
}

/**
 * 获取告警趋势数据（按天统计）
 */
export async function getAlertTrend(
  query?: number | string | { days?: string; startDate?: string; endDate?: string }
): Promise<AlertTrend[]> {
  const { startDate, endDate } = parseTimeRangeQuery(query ?? {});
  const dayMs = 24 * 60 * 60 * 1000;

  // 收集时间范围内的每一天
  const days: string[] = [];
  const current = new Date(startDate.toISOString().split('T')[0]);
  const end = new Date(endDate.toISOString().split('T')[0]);
  while (current <= end) {
    days.push(current.toISOString().split('T')[0]);
    current.setTime(current.getTime() + dayMs);
  }

  // 从 ruleService 获取所有告警
  const allAlerts = await getAlerts();

  // 按日期统计
  const stats: Record<string, AlertTrend> = {};
  for (const date of days) {
    stats[date] = { date, critical: 0, warning: 0, info: 0, total: 0 };
  }

  for (const alert of allAlerts) {
    const date = new Date(alert.timestamp).toISOString().split('T')[0];
    if (!stats[date]) continue;
    const item = stats[date];
    if (alert.severity === 'critical') item.critical++;
    else if (alert.severity === 'warning') item.warning++;
    else item.info++;
    item.total++;
  }

  return days.map((date) => {
    const item = stats[date];
    return item;
  });
}

/**
 * 获取告警统计摘要
 */
export async function getAlertStats(): Promise<AlertStats> {
  const allAlerts = await getAlerts();

  return {
    total: allAlerts.length,
    critical: allAlerts.filter((a) => a.severity === 'critical').length,
    warning: allAlerts.filter((a) => a.severity === 'warning').length,
    info: allAlerts.filter((a) => a.severity === 'info').length,
    acknowledged: allAlerts.filter((a) => a.acknowledged).length,
    unacknowledged: allAlerts.filter((a) => !a.acknowledged).length,
  };
}

/** 规则统计项 */
export interface RuleStat {
  ruleId: string;
  ruleName: string;
  priority: 'low' | 'medium' | 'high';
  enabled: boolean;
  triggerCount: number;
  lastTriggeredAt?: number;
}

/**
 * 获取规则触发统计
 */
export async function getRuleStats(): Promise<{
  total: number;
  enabled: number;
  totalTriggers: number;
  rules: RuleStat[];
}> {
  const rules = await getRules();
  let totalTriggers = 0;

  const stats: RuleStat[] = rules.map((rule) => {
    const count = rule.triggerCount || 0;
    totalTriggers += count;
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      priority: rule.priority,
      enabled: rule.enabled,
      triggerCount: count,
      lastTriggeredAt: rule.lastTriggeredAt,
    };
  });

  // 按触发次数降序排列
  stats.sort((a, b) => b.triggerCount - a.triggerCount);

  return {
    total: rules.length,
    enabled: rules.filter((r) => r.enabled).length,
    totalTriggers,
    rules: stats,
  };
}

/**
 * 获取路由决策统计（从 routerService 聚合）
 */
export async function getRouterStats(): Promise<RouterStats> {
  const stats: RoutingStats = routerService.getStats();
  const strategyNames: Record<string, string> = {
    cost_optimized: '成本优先',
    speed_optimized: '速度优先',
    quality_optimized: '质量优先',
    balanced: '均衡策略',
    custom: '自定义',
  };

  // 找出使用最多的模型
  const modelEntries = Object.entries(stats.modelUsage).sort((a, b) => b[1] - a[1]);
  const topModel = modelEntries[0]?.[0] || '-';

  // 找出使用最多的策略
  const strategyEntries = Object.entries(stats.strategyUsage).sort((a, b) => b[1] - a[1]);
  const topStrategy = strategyEntries[0]
    ? `${strategyNames[strategyEntries[0][0]] || strategyEntries[0][0]} (${strategyEntries[0][1]}次)`
    : '-';

  return {
    totalDecisions: stats.totalDecisions,
    activeModels: modelEntries.length,
    topModel,
    topStrategy,
    taskTypeDistribution: stats.taskTypeDistribution as Record<string, number>,
    strategyUsage: stats.strategyUsage as Record<string, number>,
    modelUsage: stats.modelUsage,
  };
}
