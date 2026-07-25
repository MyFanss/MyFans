import { Injectable, BadRequestException } from '@nestjs/common';
import { EventBus } from '../events/event-bus';
import { UserLoggedInEvent } from '../events/domain-events';
import { isStellarAccountAddress } from '../common/utils/stellar-address';

@Injectable()
export class AuthService {
  constructor(private readonly eventBus: EventBus) {}

  validateStellarAddress(address: string): boolean {
    return isStellarAccountAddress(address);
  }

  async createSession(stellarAddress: string) {
    if (!isStellarAccountAddress(stellarAddress)) {
      throw new BadRequestException('Invalid Stellar address');
    }
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
