import { ConversationsController } from './conversations.controller';

describe('ConversationsController – Swagger/OpenAPI documentation', () => {
  const proto = ConversationsController.prototype;

  const endpoints = [
    'create',
    'findAll',
    'findOne',
    'getMessages',
    'sendMessage',
    'remove',
  ];

  it.each(endpoints)('%s has ApiOperation metadata', (method) => {
    const metadata = Reflect.getMetadata('swagger/apiOperation', proto[method]);
    expect(metadata).toBeDefined();
    expect(typeof metadata.summary).toBe('string');
    expect(metadata.summary.length).toBeGreaterThan(0);
  });

  it.each(endpoints)('%s has at least one ApiResponse metadata', (method) => {
    const metadata = Reflect.getMetadata('swagger/apiResponse', proto[method]);
    expect(metadata).toBeDefined();
    expect(Object.keys(metadata).length).toBeGreaterThan(0);
  });

  it('controller class has ApiTags metadata', () => {
    const tags = Reflect.getMetadata('swagger/apiUseTags', ConversationsController);
    expect(tags).toContain('conversations');
  });

  const writeEndpoints = ['create', 'sendMessage', 'remove'];

  it.each(writeEndpoints)('%s documents 429 rate-limit response', (method) => {
    const metadata = Reflect.getMetadata('swagger/apiResponse', proto[method]);
    expect(metadata?.['429']).toBeDefined();
    expect(metadata['429'].description).toMatch(/too many requests/i);
  });

  const paramEndpoints = ['findOne', 'getMessages', 'sendMessage', 'remove'];

  it.each(paramEndpoints)('%s has ApiParam metadata for conversation id', (method) => {
    const params = Reflect.getMetadata('swagger/apiParameters', proto[method]);
    expect(params).toBeDefined();
    const idParam = params.find((p: { name: string }) => p.name === 'id');
    expect(idParam).toBeDefined();
  });

  const queryEndpoints = ['findAll', 'getMessages'];

  it.each(queryEndpoints)('%s documents cursor and limit query params', (method) => {
    const queries = Reflect.getMetadata('swagger/apiParameters', proto[method]) ?? [];
    const names = queries.map((q: { name: string }) => q.name);
    expect(names).toContain('cursor');
    expect(names).toContain('limit');
  });
});
