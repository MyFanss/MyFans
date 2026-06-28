import { CommentsController } from './comments.controller';

describe('CommentsController – Swagger/OpenAPI documentation', () => {
  const proto = CommentsController.prototype;

  const endpoints = ['create', 'findAll', 'findByPost', 'findOne', 'update', 'remove'];

  it.each(endpoints)('%s has ApiOperation metadata', (method) => {
    const metadata = Reflect.getMetadata('swagger/apiOperation', proto[method]);
    expect(metadata).toBeDefined();
    expect(metadata.summary).toBeDefined();
    expect(metadata.summary.length).toBeGreaterThan(0);
  });

  it.each(endpoints)('%s has at least one ApiResponse metadata', (method) => {
    const metadata = Reflect.getMetadata('swagger/apiResponse', proto[method]);
    expect(metadata).toBeDefined();
    expect(Object.keys(metadata).length).toBeGreaterThan(0);
  });

  it('controller class has ApiTags metadata', () => {
    const tags = Reflect.getMetadata('swagger/apiUseTags', CommentsController);
    expect(tags).toContain('comments');
  });

  const writeEndpoints = ['create', 'update', 'remove'];

  it.each(writeEndpoints)('%s documents 429 rate-limit response', (method) => {
    const metadata = Reflect.getMetadata('swagger/apiResponse', proto[method]);
    expect(metadata['429']).toBeDefined();
    expect(metadata['429'].description).toMatch(/too many requests/i);
  });

  const paramEndpoints = ['findOne', 'update', 'remove'];

  it.each(paramEndpoints)('%s has ApiParam metadata for id', (method) => {
    const params = Reflect.getMetadata('swagger/apiParameters', proto[method]);
    expect(params).toBeDefined();
    const idParam = params.find((p: { name: string }) => p.name === 'id');
    expect(idParam).toBeDefined();
  });

  it('findByPost has ApiParam metadata for postId', () => {
    const params = Reflect.getMetadata('swagger/apiParameters', proto.findByPost);
    expect(params).toBeDefined();
    const postIdParam = params.find((p: { name: string }) => p.name === 'postId');
    expect(postIdParam).toBeDefined();
  });

  it('create has ApiBody metadata', () => {
    const body = Reflect.getMetadata('swagger/apiBody', proto.create);
    expect(body).toBeDefined();
  });

  it('update has ApiBody metadata', () => {
    const body = Reflect.getMetadata('swagger/apiBody', proto.update);
    expect(body).toBeDefined();
  });

  it.each(['findAll', 'findByPost'])('%s has ApiQuery metadata for pagination', (method) => {
    const queries = Reflect.getMetadata('swagger/apiQuery', proto[method]);
    expect(queries).toBeDefined();
    expect(queries.length).toBeGreaterThan(0);
  });
});
