/**
 * 知墟规则调度引擎
 * 定时扫描事件数据，自动触发规则并执行动作
 */

import { logger } from './logger';
import { getRules, triggerRule, cleanupOldAlerts } from './ruleService';
import { cleanupOldEvents } from './aiCodeEventService';

// 调度器配置
const SCHEDULER_INTERVAL_MS = 60 * 1000; // 每 60 秒扫描一次规则
const RULE_COOLDOWN_MS = 5 * 60 * 1000; // 同一规则 5 分钟内不重复触发
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 每 1 小时清理一次过期数据

// 调度器状态
let schedulerTimer: NodeJS.Timeout | null = null;
let cleanupTimer: NodeJS.Timeout | null = null;
let isRunning = false;
const lastTriggeredTime: Map<string, number> = new Map();

// 调度统计
const stats = {
  totalRuns: 0,
  totalTriggers: 0,
  lastRunTime: 0,
  activeSince: Date.now(),
};

/**
 * 执行一次规则扫描
 */
export async function runRuleScan(): Promise<{
  runId: number;
  scannedRules: number;
  triggeredRules: number;
  durationMs: number;
}> {
  const start = Date.now();
  stats.totalRuns++;
  stats.lastRunTime = start;
  let triggeredCount = 0;

  logger.info(`[Scheduler] Starting rule scan #${stats.totalRuns}`);

  try {
    const rules = await getRules();
    logger.info(`[Scheduler] Scanning ${rules.length} enabled rules`);

    for (const rule of rules) {
      if (!rule.enabled) continue;

      // 冷却时间检查，避免短时间内重复触发
      const lastTriggered = lastTriggeredTime.get(rule.id) || 0;
      const cooldownRemaining = RULE_COOLDOWN_MS - (Date.now() - lastTriggered);
      if (cooldownRemaining > 0) {
        logger.debug(`[Scheduler] Rule ${rule.id} in cooldown (${Math.ceil(cooldownRemaining / 1000)}s remaining)`);
        continue;
      }

      try {
        const result = await triggerRule(rule.id);
        if (result.triggered) {
          triggeredCount++;
          stats.totalTriggers++;
          lastTriggeredTime.set(rule.id, Date.now());
          logger.info(`[Scheduler] Rule triggered: ${rule.id} (${rule.name})`, { severity: result.alert?.severity });
        }
      } catch (error) {
        logger.error(`[Scheduler] Failed to evaluate rule ${rule.id}`, { error: String(error) });
      }
    }
  } catch (error) {
    logger.error(`[Scheduler] Scan failed`, { error: String(error) });
  }

  const duration = Date.now() - start;
  logger.info(`[Scheduler] Scan complete: ${triggeredCount} rule(s) triggered in ${duration}ms`);

  return {
    runId: stats.totalRuns,
    scannedRules: stats.totalRuns,
    triggeredRules: triggeredCount,
    durationMs: duration,
  };
}

/**
 * 启动调度器
 */
export function startScheduler(): void {
  if (schedulerTimer) {
    logger.warn('[Scheduler] Scheduler is already running');
    return;
  }

  isRunning = true;
  stats.activeSince = Date.now();
  logger.info(`[Scheduler] Starting rule scheduler (interval: ${SCHEDULER_INTERVAL_MS}ms, cooldown: ${RULE_COOLDOWN_MS}ms)`);

  // 立即执行一次规则扫描
  runRuleScan().catch((e) => logger.error('[Scheduler] Initial scan failed', { error: String(e) }));

  // 按间隔定时执行规则扫描
  schedulerTimer = setInterval(() => {
    runRuleScan().catch((e) => logger.error('[Scheduler] Scheduled scan failed', { error: String(e) }));
  }, SCHEDULER_INTERVAL_MS);

  // 启动数据清理定时器（每小时执行一次）
  cleanupTimer = setInterval(async () => {
    try {
      const eventResult = await cleanupOldEvents();
      const alertResult = await cleanupOldAlerts();
      if (eventResult.removed > 0 || alertResult.removed > 0) {
        logger.info(`[Scheduler] Cleanup done: ${eventResult.removed} events, ${alertResult.removed} alerts removed`);
      }
    } catch (e) {
      logger.error('[Scheduler] Cleanup failed', { error: String(e) });
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * 停止调度器
 */
export function stopScheduler(): void {
  let stopped = false;
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    stopped = true;
  }
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    stopped = true;
  }
  if (stopped) {
    isRunning = false;
    logger.info('[Scheduler] Scheduler stopped (rule scan + data cleanup)');
  }
}

/**
 * 获取调度器状态
 */
export function getSchedulerStatus(): {
  running: boolean;
  totalRuns: number;
  totalTriggers: number;
  lastRunTime: number;
  activeSince: number;
  intervalMs: number;
  cooldownMs: number;
} {
  return {
    running: isRunning,
    totalRuns: stats.totalRuns,
    totalTriggers: stats.totalTriggers,
    lastRunTime: stats.lastRunTime,
    activeSince: stats.activeSince,
    intervalMs: SCHEDULER_INTERVAL_MS,
    cooldownMs: RULE_COOLDOWN_MS,
  };
}

/**
 * 手动触发一次扫描（用于测试）
 */
export async function triggerManualScan(): Promise<{ runId: number; triggeredRules: number; durationMs: number }> {
  logger.info('[Scheduler] Manual scan triggered');
  const result = await runRuleScan();
  return { runId: result.runId, triggeredRules: result.triggeredRules, durationMs: result.durationMs };
}
