import { Injectable } from '@nestjs/common';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreatorsService } from './creators.service';
import {
  DashboardQueryDto,
  CreatorDashboardDto,
  RevenueBreakdown,
  TimeWindow,
} from './dto/creator-dashboard.dto';

const CACHE_TTL_MS = 60_000; // 1 minute

interface CacheEntry {
  data: CreatorDashboardDto;
  expiresAt: number;
}

@Injectable()
export class CreatorDashboardService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly platformFeeBps = 500;

  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly creators: CreatorsService,
  ) {}

  async getDashboard(
    creatorAddress: string,
    query: DashboardQueryDto,
  ): Promise<CreatorDashboardDto> {
    const cacheKey = `${creatorAddress}:${query.window ?? '30d'}:${query.from ?? ''}:${query.to ?? ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const { from, to } = this.resolveWindow(query);
    const window = query.from ? 'custom' : (query.window ?? '30d');
    const data = this.aggregate(creatorAddress, from, to, window, query);

    this.cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  }

  /** Exposed for testing */
  invalidateCache(creatorAddress?: string): void {
    if (creatorAddress) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(creatorAddress)) this.cache.delete(key);
      }
    } else {
      this.cache.clear();
    }
  }

  private aggregate(
    creatorAddress: string,
    from: Date,
    to: Date,
    window: TimeWindow | 'custom',
    _query: DashboardQueryDto,
  ): CreatorDashboardDto {
    const allSubs = this.subscriptions.getAllSubscriptionsInternal();
    const creatorSubs = allSubs.filter(s => s.creator === creatorAddress);
    const nowSecs = Math.floor(Date.now() / 1000);
    const fromSecs = Math.floor(from.getTime() / 1000);
    const toSecs = Math.floor(to.getTime() / 1000);

    // Active subscribers (currently active regardless of window)
    const activeCount = creatorSubs.filter(
      s => s.status === 'active' && s.expiry > nowSecs,
    ).length;

    // New in window: created within [from, to]
    const newInWindow = creatorSubs.filter(s => {
      const createdSecs = Math.floor(new Date(s.createdAt ?? 0).getTime() / 1000);
      return createdSecs >= fromSecs && createdSecs <= toSecs;
    }).length;

    // Churned in window: expired within [from, to]
    const churned = creatorSubs.filter(s => {
      return s.status === 'expired' && s.expiry >= fromSecs && s.expiry <= toSecs;
    }).length;

    // Revenue: aggregate per plan for subs created in window
    const plans = this.creators.getCreatorPlans(creatorAddress);
    const planMap = new Map(plans.map(p => [p.id, p]));
    const byPlan = new Map<number, RevenueBreakdown>();

    for (const sub of creatorSubs) {
      const createdSecs = Math.floor(new Date(sub.createdAt ?? 0).getTime() / 1000);
      if (createdSecs < fromSecs || createdSecs > toSecs) continue;

      const plan = planMap.get(sub.planId);
      if (!plan) continue;

      const gross = parseFloat(plan.amount);
      const fee = (gross * this.platformFeeBps) / 10_000;
      const net = gross - fee;
      const asset = plan.asset.split(':')[0];

      const existing = byPlan.get(sub.planId) ?? {
        planId: sub.planId,
        asset,
        grossAmount: 0,
        feeAmount: 0,
        netAmount: 0,
        subscriptionCount: 0,
      };
      existing.grossAmount += gross;
      existing.feeAmount += fee;
      existing.netAmount += net;
      existing.subscriptionCount++;
      byPlan.set(sub.planId, existing);
    }

    const revenueByPlan = Array.from(byPlan.values());
    const grossTotal = revenueByPlan.reduce((s, r) => s + r.grossAmount, 0);
    const feeTotal = revenueByPlan.reduce((s, r) => s + r.feeAmount, 0);
    const netTotal = revenueByPlan.reduce((s, r) => s + r.netAmount, 0);

    return {
      creatorAddress,
      window,
      from: from.toISOString(),
      to: to.toISOString(),
      cachedAt: new Date().toISOString(),
      subscribers: { active: activeCount, newInWindow, churned },
      revenue: { grossTotal, feeTotal, netTotal, byPlan: revenueByPlan },
      plans: plans.map(p => ({
        id: p.id,
        asset: p.asset.split(':')[0],
        amount: parseFloat(p.amount),
        intervalDays: p.intervalDays,
        activeSubscribers: creatorSubs.filter(
          s => s.planId === p.id && s.status === 'active' && s.expiry > nowSecs,
        ).length,
      })),
    };
  }

  private resolveWindow(query: DashboardQueryDto): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    if (query.from) return { from: new Date(query.from), to };

    const from = new Date(to);
    switch (query.window ?? '30d') {
      case '7d':  from.setDate(from.getDate() - 7);   break;
      case '90d': from.setDate(from.getDate() - 90);  break;
      case 'all': from.setFullYear(2000);              break;
      default:    from.setDate(from.getDate() - 30);  break;
    }
    return { from, to };
  }
}
