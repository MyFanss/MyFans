import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { RequestContextService } from '../services/request-context.service';
import { Request, Response, NextFunction } from 'express';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;
  let requestContextService: RequestContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CorrelationIdMiddleware, RequestContextService],
    }).compile();

    middleware = module.get<CorrelationIdMiddleware>(CorrelationIdMiddleware);
    requestContextService = module.get<RequestContextService>(RequestContextService);
  });

  function makeReq(headers: Record<string, string> = {}): Partial<Request> {
    return { headers, method: 'GET', originalUrl: '/test', ip: '127.0.0.1' };
  }

  function makeRes(): Partial<Response> {
    return { setHeader: jest.fn() };
  }

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('generates new IDs when headers are absent', (done) => {
    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = () => {
      expect(req.headers!['x-correlation-id']).toBeDefined();
      expect(req.headers!['x-request-id']).toBeDefined();
      expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', expect.any(String));
      done();
    };

    middleware.use(req as Request, res as Response, next);
  });

  it('preserves existing valid UUID IDs from incoming headers', (done) => {
    const req = makeReq({
      'x-correlation-id': 'a1b2c3d4-e5f6-4789-8abc-def012345678',
      'x-request-id': 'b2c3d4e5-f6a7-4890-9bcd-ef0123456789',
    });
    const res = makeRes();
    const next: NextFunction = () => {
      expect(req.headers!['x-correlation-id']).toBe('a1b2c3d4-e5f6-4789-8abc-def012345678');
      expect(req.headers!['x-request-id']).toBe('b2c3d4e5-f6a7-4890-9bcd-ef0123456789');
      done();
    };

    middleware.use(req as Request, res as Response, next);
  });

  it('makes correlationId readable via RequestContextService inside next()', (done) => {
    const req = makeReq({ 'x-correlation-id': 'a1b2c3d4-e5f6-4789-8abc-def012345678' });
    const res = makeRes();
    const next: NextFunction = () => {
      // Inside next() we are within the AsyncLocalStorage context
      expect(requestContextService.getCorrelationId()).toBe('a1b2c3d4-e5f6-4789-8abc-def012345678');
      done();
    };

    middleware.use(req as Request, res as Response, next);
  });

  it('generates valid UUID v4 IDs when no headers provided', (done) => {
    const req = makeReq();
    const res = makeRes();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const next: NextFunction = () => {
      expect(req.headers!['x-correlation-id']).toMatch(uuidRegex);
      expect(req.headers!['x-request-id']).toMatch(uuidRegex);
      done();
    };

    middleware.use(req as Request, res as Response, next);
  });

  it('replaces invalid (non-UUID) correlation ID with a fresh UUID', (done) => {
    const req = makeReq({ 'x-correlation-id': 'not-a-uuid', 'x-request-id': 'also-bad' });
    const res = makeRes();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const next: NextFunction = () => {
      expect(req.headers!['x-correlation-id']).toMatch(uuidRegex);
      expect(req.headers!['x-request-id']).toMatch(uuidRegex);
      done();
    };

    middleware.use(req as Request, res as Response, next);
  });

  it('replaces empty-string IDs with fresh UUIDs', (done) => {
    const req = makeReq({ 'x-correlation-id': '', 'x-request-id': '' });
    const res = makeRes();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const next: NextFunction = () => {
      expect(req.headers!['x-correlation-id']).toMatch(uuidRegex);
      expect(req.headers!['x-request-id']).toMatch(uuidRegex);
      done();
    };

    middleware.use(req as Request, res as Response, next);
  });
});
