import { v4 as uuidv4 } from 'uuid';
import type { Rule, MetricData, Alert } from '@zhixu/shared/types';
import { logger } from './logger';
import { getRecentEvents } from './aiCodeEventService';
import { sendAlert, getEnabledChannels } from './alertService';
import { loadJSON, schedulePersist, saveJSON } from './storageService';
import { generatePrompt } from './promptInjectionService';
import { createHash } from 'crypto';

const STORAGE_KEY_RULES = 'alert-rules';
const STORAGE_KEY_ALERTS = 'alert-history';

const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 同一规则在 10 分钟内不重复发送告警
const ALERT_RETENTION_DAYS = 30; // 告警保留天数
const MAX_ALERTS_IN_MEMORY = 1000; // 内存中保留的最大告警数

const rules: Map<string, Rule> = new Map();
const alerts: Map<string, Alert> = new Map();

function getDefaultRules(): Rule[] {
  return [
    {
      id: 'rule-001',
      name: '上下文清理预警',
      description: '当 Token 使用超过 80% 时触发',
      enabled: true,
      condition: {
        type: 'token_threshold',
        threshold: 0.8,
        operator: '>',
      },
      action: {
        type: 'clear_context',
        config: { message: '上下文即将溢出，建议清理' },
      },
      priority: 'high',
      triggerCount: 0,
      lastTriggeredAt: undefined,
    },
    {
      id: 'rule-002',
      name: 'Token 超预算告警',
      description: '单日 Token 消耗超过阈值时发送告警',
      enabled: true,
      condition: {
        type: 'token_threshold',
        threshold: 100000,
        operator: '>',
      },
      action: {
        type: 'send_alert',
        config: { channels: JSON.stringify(['email', 'dingtalk']) },
      },
      priority: 'medium',
      triggerCount: 0,
      lastTriggeredAt: undefined,
    },
    {
      id: 'rule-003',
      name: '错误率告警',
      description: '当发生任何调用错误时触发（错误率 > 0%）',
      enabled: true,
      condition: {
        type: 'error_rate',
        threshold: 0,
        operator: '>',
      },
      action: {
        type: 'send_alert',
        config: { channels: JSON.stringify(['dingtalk']) },
      },
      priority: 'medium',
      triggerCount: 0,
      lastTriggeredAt: undefined,
    },
    {
      id: 'rule-004',
      name: '延迟过高告警',
      description: '当平均延迟超过 2000ms 时触发',
      enabled: true,
      condition: {
        type: 'latency_threshold',
        threshold: 2000,
        operator: '>',
      },
      action: {
        type: 'send_alert',
        config: { channels: JSON.stringify(['dingtalk']) },
      },
      priority: 'low',
      triggerCount: 0,
      lastTriggeredAt: undefined,
    },
  ];
}

export async function loadFromStorage(): Promise<void> {
  const savedRules = await loadJSON<Rule[]>(STORAGE_KEY_RULES, []);
  if (savedRules.length > 0) {
    // 迁移：对 rule-003/rule-004 进行阈值更新（如果是旧值）
    const defaults = getDefaultRules();
    const thresholdMigration = new Map<string, number>([
      ['rule-003', 5],   // 旧阈值
      ['rule-004', 5000],
    ]);
    let migrated = 0;
    savedRules.forEach((rule) => {
      const defaultRule = defaults.find((d) => d.id === rule.id);
      if (
        defaultRule &&
        thresholdMigration.has(rule.id) &&
        rule.condition.threshold === thresholdMigration.get(rule.id) &&
        rule.condition.type === defaultRule.condition.type
      ) {
        rule.condition.threshold = defaultRule.condition.threshold;
        rule.description = defaultRule.description;
        migrated++;
      }
      rules.set(rule.id, rule);
    });
    if (migrated > 0) {
      logger.info(`[Rules] 迁移 ${migrated} 条规则阈值`);
      schedulePersist(STORAGE_KEY_RULES, () => Array.from(rules.values()));
    }
    logger.info(`[Rules] 从持久化加载 ${savedRules.length} 条规则`);
  } else {
    const defaults = getDefaultRules();
    defaults.forEach((rule) => rules.set(rule.id, rule));
    logger.info(`[Rules] 首次启动，注入 ${defaults.length} 条默认规则`);
    schedulePersist(STORAGE_KEY_RULES, () => Array.from(rules.values()));
  }

  // 从持久化加载告警，并应用保留策略
  const savedAlerts = await loadJSON<Alert[]>(STORAGE_KEY_ALERTS, []);
  alerts.clear();
  const cutoffTime = Date.now() - ALERT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let loadedCount = 0;
  let droppedCount = 0;

  for (const alert of savedAlerts) {
    if (alert.timestamp && alert.timestamp >= cutoffTime) {
      alerts.set(alert.id, alert);
      loadedCount++;
    } else {
      droppedCount++;
    }
  }

  // 内存上限保护：超过 MAX_ALERTS_IN_MEMORY 时保留最新的
  if (alerts.size > MAX_ALERTS_IN_MEMORY) {
    const sorted = Array.from(alerts.values()).sort((a, b) => b.timestamp - a.timestamp);
    const toRemove = sorted.slice(MAX_ALERTS_IN_MEMORY);
    droppedCount += toRemove.length;
    toRemove.forEach((a) => alerts.delete(a.id));
  }

  if (loadedCount > 0) {
    logger.info(`[Alerts] 从持久化加载 ${loadedCount} 条告警记录` + (droppedCount > 0 ? `，丢弃 ${droppedCount} 条过期告警` : ''));
  } else {
    logger.info('[Alerts] 无历史告警，等待规则触发生成真实告警...');
  }
}

// 重置为默认规则
export async function resetRules(): Promise<number> {
  rules.clear();
  const defaults = getDefaultRules();
  defaults.forEach((rule) => rules.set(rule.id, rule));
  schedulePersist(STORAGE_KEY_RULES, () => Array.from(rules.values()));
  logger.info(`[Rules] 已重置为 ${defaults.length} 条默认规则`);
  return defaults.length;
}

function persistRules(): void {
  schedulePersist(STORAGE_KEY_RULES, () => Array.from(rules.values()));
}

function persistAlerts(): void {
  schedulePersist(STORAGE_KEY_ALERTS, () => Array.from(alerts.values()));
}

// 获取所有规则
export async function getRules(): Promise<Rule[]> {
  return Array.from(rules.values());
}

// 获取单个规则
export async function getRuleById(id: string): Promise<Rule | null> {
  return rules.get(id) || null;
}

// 创建规则
export async function createRule(rule: Rule): Promise<Rule> {
  const newRule: Rule = {
    ...rule,
    id: rule.id || uuidv4(),
  };
  rules.set(newRule.id, newRule);
  logger.info(`Rule created: ${newRule.id}`, { name: newRule.name });
  persistRules();
  return newRule;
}

// 更新规则
export async function updateRule(id: string, rule: Rule): Promise<Rule | null> {
  if (!rules.has(id)) {
    return null;
  }
  const updatedRule = { ...rule, id };
  rules.set(id, updatedRule);
  logger.info(`Rule updated: ${id}`, { name: rule.name });
  persistRules();
  return updatedRule;
}

// 删除规则
export async function deleteRule(id: string): Promise<void> {
  rules.delete(id);
  logger.info(`Rule deleted: ${id}`);
  persistRules();
}

// 执行动作，返回创建的告警（若在去重窗口内已发送相同告警则返回 null）
async function executeAction(rule: Rule, metricData: MetricData): Promise<Alert | null> {
  // === 去重检查：同一规则 + 同一 severity + 相同核心指标在 DEDUP_WINDOW_MS 内只发送一次 ===
  const now = Date.now();
  const severity =
    rule.priority === 'high' ? 'critical' : rule.priority === 'medium' ? 'warning' : 'info';
  const dedupKey = [
    rule.id,
    severity,
    String(Math.round(Number(metricData.metrics.tokenUsage) / 100)),
    String(Math.round(Number(metricData.metrics.errorRate))),
  ].join('|');
  const dedupHash = createHash('sha256').update(dedupKey).digest('hex').slice(0, 16);

  const recentDuplicate = Array.from(alerts.values()).find(
    (a) =>
      a.ruleId === rule.id &&
      a.metadata?.dedupHash === dedupHash &&
      now - a.timestamp < DEDUP_WINDOW_MS,
  );

  if (recentDuplicate) {
    logger.info(
      `[Dedup] 跳过重复告警: ${rule.id} (${rule.name}), 上一次触发: ${new Date(recentDuplicate.timestamp).toLocaleTimeString()}`,
      { dedupHash },
    );
    return null;
  }

  // 更新规则触发计数 + 时间，并持久化
  const existingRule = rules.get(rule.id) || rule;
  const updatedRule: Rule = {
    ...existingRule,
    triggerCount: (existingRule.triggerCount || 0) + 1,
    lastTriggeredAt: now,
  };
  rules.set(rule.id, updatedRule);
  persistRules();

  const alert: Alert = {
    id: uuidv4(),
    ruleId: rule.id,
    severity,
    title: `规则触发: ${rule.name}`,
    message: `规则 "${rule.name}" 的条件已满足 (${rule.condition.type} > ${rule.condition.threshold}). 触发动作: ${rule.action.type}`,
    timestamp: now,
    acknowledged: false,
    metadata: {
      tokenUsage: String(metricData.metrics.tokenUsage),
      errorRate: String(metricData.metrics.errorRate),
      avgLatency: String(metricData.metrics.avgLatency),
      requestCount: String(metricData.metrics.requestCount),
      dedupHash,
    },
  };

  alerts.set(alert.id, alert);

  // 告警保留策略检查：超过 MAX_ALERTS_IN_MEMORY 时删除最老的告警
  if (alerts.size > MAX_ALERTS_IN_MEMORY) {
    const sorted = Array.from(alerts.values()).sort((a, b) => b.timestamp - a.timestamp);
    const toRemove = sorted.slice(MAX_ALERTS_IN_MEMORY);
    toRemove.forEach((a) => alerts.delete(a.id));
    logger.info(`[Alerts] 保留策略：删除 ${toRemove.length} 条最老告警，保留最新 ${MAX_ALERTS_IN_MEMORY} 条`);
  }

  logger.info(`Alert generated: ${alert.id}`, { ruleId: rule.id, action: rule.action.type, severity: alert.severity, triggerCount: updatedRule.triggerCount });
  persistAlerts();

  // === 动作类型特定逻辑 ===
  // inject_prompt / clear_context: 生成可复制的 Prompt 并持久化
  const actionType = rule.action.type;
  if (actionType === 'inject_prompt' || actionType === 'clear_context') {
    try {
      const ctx = {
        tokenUsage: Number(alert.metadata?.tokenUsage ?? 0),
        errorRate: Number(alert.metadata?.errorRate ?? 0),
        avgLatency: Number(alert.metadata?.avgLatency ?? 0),
        requestCount: Number(alert.metadata?.requestCount ?? 0),
      };
      const injection = await generatePrompt(
        rule.id,
        rule.name,
        rule.condition.type,
        ctx,
      );
      logger.info(`[Rule] ${rule.action.type} 已生成提示: ${injection.id}`);
      // 把提示注入 ID 记录到告警的 metadata 中，便于追踪
      alert.metadata = { ...(alert.metadata || {}), promptInjectionId: injection.id };
    } catch (error) {
      logger.error(`[Rule] ${rule.action.type} 生成提示失败`, { error: String(error) });
    }
  }

  // === 告警通道发送（所有动作类型都发送）===
  let channels: string[] = [];
  const rawChannels = rule.action.config.channels;
  if (Array.isArray(rawChannels)) {
    channels = rawChannels as string[];
  } else if (typeof rawChannels === 'string' && rawChannels.length > 0) {
    try {
      channels = JSON.parse(rawChannels) as string[];
    } catch {
      channels = [rawChannels];
    }
  }
  if (channels.length === 0) {
    channels = getEnabledChannels();
  }

  if (channels.length > 0) {
    try {
      const result = await sendAlert(alert, channels);
      const successCount = result.results.filter((r) => r.success).length;
      const totalCount = result.results.length;
      logger.info(`Alert delivered: ${successCount}/${totalCount} channels`, { alertId: alert.id, results: result.results });
    } catch (error) {
      logger.error(`Failed to deliver alert`, { alertId: alert.id, error: String(error) });
    }
  } else {
    logger.warn(`No alert channels configured, alert stored only in memory`, { alertId: alert.id });
  }

  return alert;
}

// 触发规则（支持评估并执行）
export async function triggerRule(id: string): Promise<{ triggered: boolean; alert?: Alert; error?: string }> {
  const rule = rules.get(id);
  if (!rule) {
    return { triggered: false, error: `Rule not found: ${id}` };
  }

  if (!rule.enabled) {
    return { triggered: false, error: 'Rule is disabled' };
  }

  // 获取最近的事件数据用于评估
  const events = await getRecentEvents(100);
  const metricData = evaluateEvents(events, rule);

  // 检查条件是否满足
  if (evaluateCondition(rule, metricData)) {
    const generatedAlert = await executeAction(rule, metricData);
    return { triggered: true, alert: generatedAlert };
  }

  return { triggered: false };
}

// 根据规则类型选择合适的时间窗口
function getTimeWindowMs(rule: Rule): number {
  // 日消耗类规则用 24 小时窗口，延迟和错误率用 1 小时，上下文清理用 1 小时
  switch (rule.condition.type) {
    case 'token_threshold':
      return rule.condition.threshold > 1 ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    case 'error_rate':
    case 'latency_threshold':
      return 60 * 60 * 1000;
    case 'request_count':
      return 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
}

// 评估事件数据（按规则区分时间窗口）
function evaluateEvents(events: any[], rule: Rule): MetricData {
  const now = Date.now();
  const windowMs = getTimeWindowMs(rule);

  const recentEvents = events.filter((e) => now - e.timestamp < windowMs);

  const totalTokens = recentEvents.reduce((sum, e) => {
    if (e.tokenConsumption?.total !== undefined) {
      return sum + Number(e.tokenConsumption.total);
    }
    const input = Number(e.tokenConsumption?.input || 0);
    const output = Number(e.tokenConsumption?.output || 0);
    return sum + input + output;
  }, 0);

  const errorCount = recentEvents.filter((e) => e.quality?.errorType).length;
  const totalLatency = recentEvents.reduce((sum, e) => sum + (e.performance?.latency || 0), 0);

  const errorRate = recentEvents.length > 0 ? (errorCount / recentEvents.length) * 100 : 0;
  const avgLatency = recentEvents.length > 0 ? totalLatency / recentEvents.length : 0;

  const metricData: MetricData = {
    sessionId: 'current',
    timestamp: now,
    tool: 'trae',
    metrics: {
      tokenUsage: totalTokens,
      tokenLimit: rule.condition.type === 'token_threshold' && rule.condition.threshold <= 1
        ? 200000
        : (rule.condition.threshold as number) * 2,
      errorRate,
      avgLatency,
      requestCount: recentEvents.length,
    },
  };

  logger.info(`[RuleEval] ${rule.id} (${rule.name}): window=${Math.round(windowMs / 60000)}min, events=${recentEvents.length}, tokens=${totalTokens}, errorRate=${errorRate.toFixed(1)}%, avgLatency=${Math.round(avgLatency)}ms, threshold=${rule.condition.threshold}${rule.condition.type === 'token_threshold' && rule.condition.threshold <= 1 ? '' : ''}`);

  return metricData;
}

// 评估条件
function evaluateCondition(rule: Rule, data: MetricData): boolean {
  const { condition } = rule;
  const value =
    condition.type === 'token_threshold'
      ? condition.threshold <= 1
        ? data.metrics.tokenUsage / data.metrics.tokenLimit
        : data.metrics.tokenUsage
      : condition.type === 'error_rate'
        ? data.metrics.errorRate
        : condition.type === 'latency_threshold'
          ? data.metrics.avgLatency
          : condition.type === 'request_count'
            ? data.metrics.requestCount
            : 0;

  switch (condition.operator) {
    case '>':
      return value > condition.threshold;
    case '<':
      return value < condition.threshold;
    case '>=':
      return value >= condition.threshold;
    case '<=':
      return value <= condition.threshold;
    case '==':
      return value === condition.threshold;
    default:
      return false;
  }
}

// 获取告警列表
export async function getAlerts(): Promise<Alert[]> {
  return Array.from(alerts.values()).sort((a, b) => b.timestamp - a.timestamp);
}

// 确认告警
export async function acknowledgeAlert(id: string): Promise<void> {
  const alert = alerts.get(id);
  if (alert) {
    alert.acknowledged = true;
    alerts.set(id, alert);
    persistAlerts();
  }
}

// 批量确认所有未处理的告警，返回确认数量
export async function acknowledgeAllAlerts(): Promise<number> {
  let count = 0;
  alerts.forEach((alert) => {
    if (!alert.acknowledged) {
      alert.acknowledged = true;
      alerts.set(alert.id, alert);
      count++;
    }
  });
  if (count > 0) {
    persistAlerts();
  }
  return count;
}

/** 重置告警：清空所有记录并持久化空数据。返回 0 */
export async function resetAlertsToSample(): Promise<number> {
  alerts.clear();
  await saveJSON(STORAGE_KEY_ALERTS, []);
  logger.info('[Alerts] 已清空所有告警（真实数据模式：不注入演示数据）');
  return 0;
}

/** 清空所有告警。返回 0 */
export async function clearAllAlerts(): Promise<number> {
  alerts.clear();
  await saveJSON(STORAGE_KEY_ALERTS, []);
  logger.info('[Alerts] 已清空所有告警记录');
  return 0;
}

/** 检查是否有告警数据 */
export function hasRealAlerts(): boolean {
  return alerts.size > 0;
}

/** 清理超期告警（可定期调用） */
export async function cleanupOldAlerts(): Promise<{ removed: number; remaining: number }> {
  const cutoffTime = Date.now() - ALERT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const [id, alert] of alerts.entries()) {
    if (alert.timestamp < cutoffTime) {
      alerts.delete(id);
      removed++;
    }
  }
  if (removed > 0) {
    persistAlerts();
    logger.info(`[Alerts] 清理 ${removed} 条超期告警，剩余 ${alerts.size} 条`);
  }
  return { removed, remaining: alerts.size };
}
