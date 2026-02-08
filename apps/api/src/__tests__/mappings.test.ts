import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

describe('POST /api/mappings/suggest', () => {
  it('returns 400 when sourceFields or templateFields are missing', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/mappings/suggest')
      .send({ sourceFields: [], templateFields: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sourceFields and templateFields are required/);
  });
});
