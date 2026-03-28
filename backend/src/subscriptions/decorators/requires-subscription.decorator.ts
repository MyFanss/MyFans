import { SetMetadata } from '@nestjs/common';

export const CREATOR_KEY = 'gated:creator';

/**
 * Mark a route as requiring an active subscription to `creatorAddress`.
 * Use a literal address or the string `':creatorId'` to read from route params.
 *
 * @example
 * \@RequiresSubscription('GABC...')
 * \@RequiresSubscription(':creatorId')   // reads req.params.creatorId
 */
export const RequiresSubscription = (creatorAddress: string) =>
  SetMetadata(CREATOR_KEY, creatorAddress);
