import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StructuredLogDto } from './structured-log.dto';

async function validateDto(plain: object) {
  const dto = plainToInstance(StructuredLogDto, plain);
  return validate(dto);
}

describe('StructuredLogDto - invalid input', () => {
  it('rejects an unsupported log level', async () => {
    const errors = await validateDto({
      level: 'fatal',
      message: 'payment failed',
    });

    expect(errors.some((e) => e.property === 'level')).toBe(true);
  });

  it('rejects a missing message', async () => {
    const errors = await validateDto({ level: 'info' });

    expect(errors.some((e) => e.property === 'message')).toBe(true);
  });

  it('rejects an empty message', async () => {
    const errors = await validateDto({ level: 'warn', message: '' });

    expect(errors.some((e) => e.property === 'message')).toBe(true);
  });

  it('rejects a non-string context', async () => {
    const errors = await validateDto({
      level: 'error',
      message: 'job failed',
      context: 123,
    });

    expect(errors.some((e) => e.property === 'context')).toBe(true);
  });

  it('rejects non-object structured data', async () => {
    const errors = await validateDto({
      level: 'debug',
      message: 'payload',
      data: 'raw-token',
    });

    expect(errors.some((e) => e.property === 'data')).toBe(true);
  });
});
