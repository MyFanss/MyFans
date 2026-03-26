import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from './feature-flags.service';
import { FEATURE_FLAG_KEY } from './feature-flag.decorator';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureFlagsService: FeatureFlagsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredFlag = this.reflector.getAllAndOverride<string>(
      FEATURE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFlag) {
      return true;
    }

    const isEnabled = this.checkFlag(requiredFlag);

    if (!isEnabled) {
      throw new ForbiddenException(
        `Feature "${requiredFlag}" is not enabled`,
      );
    }

    return true;
  }

  private checkFlag(flag: string): boolean {
    switch (flag) {
      case 'newSubscriptionFlow':
        return this.featureFlagsService.isNewSubscriptionFlowEnabled();
      case 'cryptoPayments':
        return this.featureFlagsService.isCryptoPaymentsEnabled();
      default:
        return false;
    }
  }
}
