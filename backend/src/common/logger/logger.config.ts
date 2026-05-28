import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import { AsyncLocalStorage } from 'async_hooks';
import type { RequestContext } from '../services/request-context.service';

// Re-use the same module-level storage instance exported by RequestContextService.
// We import the type only; the actual storage is accessed via a lazy getter so
// there is no circular-dependency issue at module load time.
let _storage: AsyncLocalStorage<RequestContext> | undefined;

function getStorage(): AsyncLocalStorage<RequestContext> | undefined {
  if (!_storage) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('../services/request-context.service') as {
        getRequestContextStorage?: () => AsyncLocalStorage<RequestContext>;
      };
      _storage = mod.getRequestContextStorage?.();
    } catch {
      // not available yet – skip
    }
  }
  return _storage;
}

/** Winston format that injects correlationId / requestId from AsyncLocalStorage. */
const requestContextFormat = winston.format((info) => {
  const store = getStorage()?.getStore();
  if (store) {
    info['correlationId'] = store.correlationId;
    info['requestId'] = store.requestId;
    if (store.userId) info['userId'] = store.userId;
  }
  return info;
});

export const loggerConfig = {
    transports: [
        new winston.transports.Console({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.ms(),
                requestContextFormat(),
                process.env.NODE_ENV === 'production'
                    ? winston.format.json()
                    : nestWinstonModuleUtilities.format.nestLike('MyFans', {
                        colors: true,
                        prettyPrint: true,
                    }),
            ),
        }),
    ],
};
