import { Hono } from 'hono';
import type { Env } from '../../env.js';

export function createApp() {
    const app = new Hono<{ Bindings: Env }>();

    app.get('/health', c => c.json({ status: 'ok' }));
    app.all('/api/*', c => c.notFound());
    app.all('/events', c => c.notFound());
    app.get('*', c => c.env.ASSETS.fetch(c.req.raw));

    return app;
}

const app = createApp();

export default app;
