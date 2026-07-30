import { AuthController } from './auth.controller';

describe('AuthController – Swagger/OpenAPI documentation', () => {
  const proto = AuthController.prototype;

  const endpoints = ['login', 'register', 'requestChallenge', 'verifyChallenge'];

  it('controller class has ApiTags metadata', () => {
    const tags = Reflect.getMetadata('swagger/apiUseTags', AuthController);
    expect(tags).toContain('auth');
  });

  it.each(endpoints)('%s has ApiOperation metadata', (method) => {
    const meta = Reflect.getMetadata('swagger/apiOperation', proto[method]);
    expect(meta).toBeDefined();
    expect(meta.summary).toBeDefined();
    expect(meta.summary.length).toBeGreaterThan(0);
  });

  it.each(endpoints)('%s has at least one ApiResponse', (method) => {
    const meta = Reflect.getMetadata('swagger/apiResponse', proto[method]);
    expect(meta).toBeDefined();
    expect(Object.keys(meta).length).toBeGreaterThan(0);
  });

  it.each(endpoints)('%s documents 429 rate-limit response', (method) => {
    const meta = Reflect.getMetadata('swagger/apiResponse', proto[method]);
    expect(meta['429']).toBeDefined();
    expect(meta['429'].description).toMatch(/too many requests/i);
  });

  it.each(endpoints)('%s documents the x-network header', (method) => {
    const params: Array<{ name: string; in: string }> | undefined =
      Reflect.getMetadata('swagger/apiParameters', proto[method]);
    expect(params).toBeDefined();
    const header = params!.find((p) => p.name === 'x-network' && p.in === 'header');
    expect(header).toBeDefined();
  });

  it.each(['login', 'register'])('%s has ApiBody metadata', (method) => {
    // @ApiBody registers in swagger/apiParameters with { in: 'body' }
    const params: Array<{ in: string; type?: unknown }> | undefined =
      Reflect.getMetadata('swagger/apiParameters', proto[method]);
    expect(params).toBeDefined();
    const bodyParam = params!.find((p) => p.in === 'body');
    expect(bodyParam).toBeDefined();
    expect(bodyParam!.type).toBeDefined();
  });

  it('register is marked deprecated in ApiOperation', () => {
    const meta = Reflect.getMetadata('swagger/apiOperation', proto['register']);
    expect(meta.deprecated).toBe(true);
  });

  it('login documents a 400 error response', () => {
    const meta = Reflect.getMetadata('swagger/apiResponse', proto['login']);
    expect(meta['400']).toBeDefined();
  });

  it('verifyChallenge documents 401 unauthorized response', () => {
    const meta = Reflect.getMetadata('swagger/apiResponse', proto['verifyChallenge']);
    expect(meta['401']).toBeDefined();
    expect(meta['401'].description).toMatch(/expired|replayed/i);
  });

  it('requestChallenge documents a 400 error response', () => {
    const meta = Reflect.getMetadata('swagger/apiResponse', proto['requestChallenge']);
    expect(meta['400']).toBeDefined();
  });
});
