/**
 * Story card: add-todo
 *   GIVEN the to-do list is empty
 *   WHEN the user submits a new task title
 *   THEN the task appears in the list
 *
 * Hermetic: static SPA build, every /api/** call mocked in-page.
 */
import { test, expect, type Page } from '@playwright/test';

interface MockTask { id: string; title: string; completed: boolean; createdAt: string }

async function mockApi(page: Page, tasks: MockTask[]): Promise<void> {
  const store: { user: { id: string; email: string; role: string } | null } = { user: null };
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    const apiPath = new URL(req.url()).pathname
      .replace(/^.*\/api\//, '').replace(/^api\//, '').replace(/^\//, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (method === 'POST' && apiPath === 'auth/login') {
      store.user = { id: '1', email: 'user@example.com', role: 'USER' };
      return json(store.user);
    }
    if (method === 'GET' && apiPath === 'users/me') {
      return store.user ? json(store.user) : json({ message: 'Unauthorized' }, 401);
    }
    if (apiPath === 'tasks') {
      if (!store.user) return json({ message: 'Unauthorized' }, 401);
      if (method === 'GET') return json(tasks);
      if (method === 'POST') {
        const body = req.postDataJSON() as { title?: string };
        const title = (body?.title ?? '').trim();
        if (!title) return json({ message: 'title is required' }, 400);
        const task = { id: `t${tasks.length + 1}`, title, completed: false, createdAt: new Date().toISOString() };
        tasks.push(task);
        return json(task, 201);
      }
    }
    if (method === 'GET') return json([]);
    return json({ ok: true });
  });
}

async function login(page: Page): Promise<void> {
  await page.goto('/#/login');
  await page.locator('#email').fill('user@example.com');
  await page.locator('#password').fill('password1234');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 10_000 });
}

test.use({ serviceWorkers: 'block' });

test('signed-in user adds a task to an empty list and sees it listed on /', async ({ page }) => {
  const tasks: MockTask[] = [];
  await mockApi(page, tasks);
  await login(page);

  await page.goto('/#/');
  await expect(page.locator('.landing-hero')).toHaveCount(0);
  await expect(page.getByTestId('todo-form')).toBeVisible();
  await expect(page.getByTestId('todo-empty')).toBeVisible();
  await expect(page.getByTestId('todo-empty')).toContainText(/no tasks/i);

  await page.getByTestId('todo-input').fill('Buy milk');
  await page.getByTestId('todo-add').click();

  const list = page.getByTestId('todo-list');
  await expect(list).toBeVisible();
  await expect(list.getByTestId('todo-item')).toHaveText(['Buy milk']);
  await expect(page.getByTestId('todo-input')).toHaveValue('');
  expect(tasks.map(t => t.title)).toEqual(['Buy milk']);
});

test('anonymous visitor at / still sees the landing hero, not the to-do form', async ({ page }) => {
  await mockApi(page, []);
  await page.goto('/#/');
  await expect(page.locator('.landing-hero')).toBeVisible();
  await expect(page.getByTestId('todo-form')).toHaveCount(0);
});
