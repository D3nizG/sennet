import { describe, it, expect } from 'vitest';
import { createApp } from '../app.js';

describe('createApp', () => {
  it('registers health and API route mounts', () => {
    const prisma = {} as any;
    const app = createApp(prisma);

    const stack = (app as any)._router?.stack ?? [];
    const routes = stack
      .filter((l: any) => l.route)
      .map((l: any) => ({ path: l.route.path, methods: l.route.methods }));
    const mounts = stack.filter((l: any) => l.name === 'router');

    expect(routes.some((r: any) => r.path === '/health' && r.methods.get)).toBe(true);
    expect(mounts.length).toBeGreaterThanOrEqual(3);
  });
});
