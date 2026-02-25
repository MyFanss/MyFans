import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';

export const loggerConfig = {
    transports: [
        new winston.transports.Console({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.ms(),
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
