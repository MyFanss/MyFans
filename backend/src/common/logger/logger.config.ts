import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import { AsyncLocalStorage } from 'async_hooks';
import type { RequestContext } from '../services/request-context.service';
import { LOG_FIELDS, SERVICE_NAME } from './log-fields';

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

/** Winston format that injects the mandatory `service` field and optional
 *  request-context fields using the canonical LOG_FIELDS names. */
const requestContextFormat = winston.format((info) => {
  // Mandatory: service identifier present on every log line.
  info[LOG_FIELDS.SERVICE] = SERVICE_NAME;

  const store = getStorage()?.getStore();
  if (store) {
    info[LOG_FIELDS.CORRELATION_ID] = store.correlationId;
    info[LOG_FIELDS.REQUEST_ID] = store.requestId;
    if (store.userId) info[LOG_FIELDS.USER_ID] = store.userId;
    if (store.method) info[LOG_FIELDS.METHOD] = store.method;
    if (store.url) info[LOG_FIELDS.URL] = store.url;
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
