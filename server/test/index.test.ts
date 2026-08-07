import { describe, expect, it } from 'bun:test';
import app from '../src/index';

describe('server Worker', () => {
    it('serves a health check without authentication or Bkper access', async () => {
        const response = await app.request('/health');

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ status: 'ok' });
    });

    it('does not expose app API or event routes', async () => {
        const response = await app.request('/api/v1/ping', {}, createTestEnv());

        expect(response.status).toBe(404);
    });
});

function createTestEnv() {
    return {
        ASSETS: {
            fetch: async () => new Response('asset fallback'),
        },
    };
}
