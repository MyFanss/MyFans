import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Body size limits and multipart upload caps (issue #1775).
 *
 * Defaults (overridable via env):
 *  - MAX_JSON_BODY_BYTES: max JSON / urlencoded body size (default 1mb).
 *  - MAX_MULTIPART_BODY_BYTES: max multipart body size for /content/upload
 *    (default 25mb).
 *
 * Oversized payloads must be rejected with HTTP 413 before reaching
 * auth-heavy parsers.
 */
const DEFAULT_JSON_LIMIT = 1024 * 1024; // 1mb
const DEFAULT_MULTIPART_LIMIT = 25 * 1024 * 1024; // 25mb

describe('Body size limits (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const jsonLimit = Number(process.env.MAX_JSON_BODY_BYTES) || DEFAULT_JSON_LIMIT;
  const multipartLimit =
    Number(process.env.MAX_MULTIPART_BODY_BYTES) || DEFAULT_MULTIPART_LIMIT;

  describe('JSON body limit', () => {
    it('accepts a body exactly at the configured boundary', async () => {
      // Build a JSON payload whose serialized size equals the limit.
      const envelope = JSON.stringify({ data: '' });
      const padding = 'a'.repeat(jsonLimit - envelope.length);
      const body = JSON.stringify({ data: padding });
      expect(Buffer.byteLength(body)).toBe(jsonLimit);

      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send(body)
        .expect((res) => {
          expect(res.status).not.toBe(413);
        });
    });

    it('rejects a JSON body one byte over the limit with 413', async () => {
      const envelope = JSON.stringify({ data: '' });
      const padding = 'a'.repeat(jsonLimit - envelope.length + 1);
      const body = JSON.stringify({ data: padding });
      expect(Buffer.byteLength(body)).toBe(jsonLimit + 1);

      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(413);
    });

    it('rejects an oversized chunked JSON body with 413', async () => {
      const chunk = 'a'.repeat(64 * 1024);
      const chunks = Math.ceil((jsonLimit + 1) / chunk.length);

      const req = request(app.getHttpServer())
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .set('Transfer-Encoding', 'chunked');

      for (let i = 0; i < chunks; i += 1) {
        req.write(chunk);
      }

      await req.expect(413);
    });
  });

  describe('multipart upload cap', () => {
    it('accepts a multipart body at the configured boundary', async () => {
      const boundary = '----body-limits-boundary';
      const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`;
      const footer = `\r\n--${boundary}--\r\n`;
      const overhead = Buffer.byteLength(header) + Buffer.byteLength(footer);
      const fileSize = multipartLimit - overhead;
      const payload = Buffer.concat([
        Buffer.from(header),
        Buffer.alloc(fileSize, 0x61),
        Buffer.from(footer),
      ]);
      expect(payload.length).toBe(multipartLimit);

      await request(app.getHttpServer())
        .post('/content/upload')
        .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
        .send(payload)
        .expect((res) => {
          expect(res.status).not.toBe(413);
        });
    });

    it('rejects an oversized multipart upload with 413', async () => {
      const boundary = '----body-limits-boundary';
      const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`;
      const footer = `\r\n--${boundary}--\r\n`;
      const overhead = Buffer.byteLength(header) + Buffer.byteLength(footer);
      const fileSize = multipartLimit - overhead + 1;
      const payload = Buffer.concat([
        Buffer.from(header),
        Buffer.alloc(fileSize, 0x61),
        Buffer.from(footer),
      ]);
      expect(payload.length).toBe(multipartLimit + 1);

      await request(app.getHttpServer())
        .post('/content/upload')
        .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
        .send(payload)
        .expect(413);
    });
  });
});
