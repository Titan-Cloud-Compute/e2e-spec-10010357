/**
 * admin_only auth model (hermetic: static SPA, hash routing, /api/** mocked).
 *   - /signup no longer exists: it falls through to the login form.
 *   - anonymous visitors cannot open the app shell.
 *   - a signed-in non-admin opening /admin/* is redirected to /dashboard.
 *   - an ADMIN still reaches /admin/overview.
 */
import { test, expect, type Page } from '@playwright/test';

async function mockApi(page: Page): Promise<void> {
  const store: { user: { id: string; email: string; name: string; role: string } | null } = { user: null };
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    const apiPath = new URL(req.url()).pathname
      .replace(/^.*\/api\//, '').replace(/^api\//, '').replace(/^\//, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (method === 'POST' && apiPath === 'auth/login') {
      const email = String((req.postDataJSON() ?? {}).email ?? '');
      const role = email.startsWith('admin@') ? 'ADMIN' : 'USER';
      store.user = { id: role === 'ADMIN' ? '2' : '1', email, name: email, role };
      return json(store.user);
    }
    if (method === 'POST' && apiPath === 'auth/signup') return json({ message: 'Not Found' }, 404);
    if (method === 'GET' && (apiPath === 'users/me' || apiPath === 'auth/me')) {
      return store.user ? json(store.user) : json({ message: 'Unauthorized' }, 401);
    }
    if (method === 'GET') return json([]);
    return json({ ok: true });
  });
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/#/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill('password1234');
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/#\/login/, { timeout: 10_000 });
}

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => { await mockApi(page); });

test('/signup renders the login form and no signup UI', async ({ page }) => {
  await page.goto('/#/signup');
  await expect(page).toHaveURL(/#\/login/);
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('app-signup')).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toMatch(/sign up|create account|regist/i);
});

test('anonymous visitors cannot open the app shell or admin pages', async ({ page }) => {
  await page.goto('/#/dashboard');
  await expect(page).toHaveURL(/#\/login/);
  await page.goto('/#/admin/overview');
  await expect(page).toHaveURL(/#\/login/);
});

test('a non-admin opening an admin page is redirected to /dashboard', async ({ page }) => {
  await login(page, 'user@demo.local');
  for (const r of ['admin', 'admin/overview', 'admin/users', 'admin/app-settings']) {
    await page.goto(`/#/${r}`);
    await expect(page, r).toHaveURL(/#\/dashboard/);
  }
});

test('an admin still reaches /admin/overview', async ({ page }) => {
  await login(page, 'admin@demo.local');
  await page.goto('/#/admin/overview');
  await expect(page).toHaveURL(/#\/admin\/overview/);
  await expect(page.locator('main.main-content')).toBeVisible();
});
