import { Injectable } from '@nestjs/common';
import { EventBus } from '../events/event-bus';
import { PlanCreatedEvent } from '../events/domain-events';

export interface Plan {
  id: number;
  creator: string;
  asset: string;
  amount: string;
  intervalDays: number;
}

@Injectable()
export class CreatorsService {
  private plans: Map<number, Plan> = new Map();
  private planCounter = 0;

  constructor(private readonly eventBus: EventBus) {}

  createPlan(creator: string, asset: string, amount: string, intervalDays: number): Plan {
    const plan = { id: ++this.planCounter, creator, asset, amount, intervalDays };
    this.plans.set(plan.id, plan);

    this.eventBus.publish(
      new PlanCreatedEvent(plan.id, creator, asset, amount),
    );

    return plan;
  }

  getPlan(id: number): Plan | undefined {
    return this.plans.get(id);
  }

  getCreatorPlans(creator: string): Plan[] {
    return Array.from(this.plans.values()).filter(p => p.creator === creator);
  }
}
