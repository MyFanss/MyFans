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

  it('preserves existing IDs from incoming headers', (done) => {
    const req = makeReq({
      'x-correlation-id': 'cid-123',
      'x-request-id': 'rid-456',
    });
    const res = makeRes();
    const next: NextFunction = () => {
      expect(req.headers!['x-correlation-id']).toBe('cid-123');
      expect(req.headers!['x-request-id']).toBe('rid-456');
      done();
    };

    middleware.use(req as Request, res as Response, next);
  });

  it('makes correlationId readable via RequestContextService inside next()', (done) => {
    const req = makeReq({ 'x-correlation-id': 'trace-abc' });
    const res = makeRes();
    const next: NextFunction = () => {
      // Inside next() we are within the AsyncLocalStorage context
      expect(requestContextService.getCorrelationId()).toBe('trace-abc');
      done();
    };

    middleware.use(req as Request, res as Response, next);
  });

  it('generates valid UUID v4 IDs', (done) => {
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

  it('isolates context between concurrent requests', (done) => {
    const req1 = makeReq({ 'x-correlation-id': 'cid-req1' });
    const req2 = makeReq({ 'x-correlation-id': 'cid-req2' });
    const res = makeRes();
    let completed = 0;
    const next1: NextFunction = () => {
      // Simulate async work inside req1's context
      setImmediate(() => {
        expect(requestContextService.getCorrelationId()).toBe('cid-req1');
        if (++completed === 2) done();
      });
    };
    const next2: NextFunction = () => {
      setImmediate(() => {
        expect(requestContextService.getCorrelationId()).toBe('cid-req2');
        if (++completed === 2) done();
      });
    };

    middleware.use(req1 as Request, res as Response, next1);

    middleware.use(req2 as Request, res as Response, next2);
  });
});
