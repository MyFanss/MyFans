import { Injectable } from '@nestjs/common';
import { EventBus } from '../events/event-bus';
import { UserLoggedInEvent } from '../events/domain-events';
import { AuditService } from '../audit/audit.service';
import { AuditableAction } from '../audit/auditable-action';

@Injectable()
export class AuthService {
  constructor(
    private readonly eventBus: EventBus,
    private readonly auditService: AuditService,
  ) {}

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

    void this.auditService.record({
      action: AuditableAction.AUTH_SESSION_CREATED,
      actorType: 'user',
      actorId: stellarAddress,
      metadata: {
        addressPrefix: `${stellarAddress.slice(0, 8)}…`,
      },
    });

    return session;
  }
}
