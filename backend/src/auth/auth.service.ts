import { Injectable } from '@nestjs/common';
import { EventBus } from '../events/event-bus';
import { UserLoggedInEvent } from '../events/domain-events';

@Injectable()
export class AuthService {
  constructor(private readonly eventBus: EventBus) {}

  validateStellarAddress(address: string): boolean {
    return address.startsWith('G') && address.length === 56;
  }

  async createSession(stellarAddress: string) {
    const session = {
      userId: stellarAddress,
      token: Buffer.from(stellarAddress).toString('base64'),
    };

    this.eventBus.publish(
      new UserLoggedInEvent(session.userId, stellarAddress),
    );

    return session;
  }
}
