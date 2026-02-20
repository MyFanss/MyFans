import { Injectable } from '@nestjs/common';

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

  createPlan(creator: string, asset: string, amount: string, intervalDays: number): Plan {
    const plan = { id: ++this.planCounter, creator, asset, amount, intervalDays };
    this.plans.set(plan.id, plan);
    return plan;
  }

  getPlan(id: number): Plan | undefined {
    return this.plans.get(id);
  }

  getCreatorPlans(creator: string): Plan[] {
    return Array.from(this.plans.values()).filter(p => p.creator === creator);
  }
}
