/**
 * Story card: delete-todo
 *   GIVEN the to-do list has one task
 *   WHEN the user deletes the task
 *   THEN the list is empty again
 *
 * Hermetic: static SPA build, every /api/** call mocked in-page.
 */
import { test, expect, type Page } from '@playwright/test';

interface MockTask { id: string; title: string; completed: boolean; createdAt: string }

async function mockApi(page: Page, tasks: MockTask[], opts: { failDelete?: boolean } = {}): Promise<string[]> {
  const deleted: string[] = [];
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
    if (apiPath === 'tasks' && method === 'GET') {
      if (!store.user) return json({ message: 'Unauthorized' }, 401);
      return json(tasks);
    }
    const m = /^tasks\/([^/]+)$/.exec(apiPath);
    if (m && method === 'DELETE') {
      if (!store.user) return json({ message: 'Unauthorized' }, 401);
      if (opts.failDelete) return json({ message: 'boom' }, 500);
      const id = decodeURIComponent(m[1]);
      const i = tasks.findIndex(t => t.id === id);
      if (i < 0) return json({ message: 'task not found' }, 404);
      tasks.splice(i, 1);
      deleted.push(id);
      return route.fulfill({ status: 204, body: '' });
    }
    if (method === 'GET') return json([]);
    return json({ ok: true });
  });
  return deleted;
}

async function login(page: Page): Promise<void> {
  await page.goto('/#/login');
  await page.locator('#email').fill('user@example.com');
  await page.locator('#password').fill('password1234');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 10_000 });
}

test.use({ serviceWorkers: 'block' });

test('signed-in user deletes the only task and the list is empty again', async ({ page }) => {
  const tasks: MockTask[] = [{ id: 't1', title: 'Buy milk', completed: false, createdAt: new Date().toISOString() }];
  const deleted = await mockApi(page, tasks);
  await login(page);

  await page.goto('/#/');
  const items = page.getByTestId('todo-item');
  await expect(items).toHaveText(['Buy milk']);
  await expect(page.getByTestId('todo-delete')).toHaveCount(1);
  await expect(page.getByTestId('todo-empty')).toHaveCount(0);

  await page.getByRole('button', { name: 'Delete Buy milk' }).click();

  await expect(items).toHaveCount(0);
  await expect(page.getByTestId('todo-empty')).toBeVisible();
  await expect(page.getByTestId('todo-empty')).toContainText(/no tasks/i);
  expect(deleted).toEqual(['t1']);
  expect(tasks).toEqual([]);
});

test('a failed delete puts the task back and shows the error', async ({ page }) => {
  const tasks: MockTask[] = [{ id: 't1', title: 'Buy milk', completed: false, createdAt: new Date().toISOString() }];
  await mockApi(page, tasks, { failDelete: true });
  await login(page);

  await page.goto('/#/');
  await page.getByTestId('todo-delete').click();
  await expect(page.getByTestId('todo-error')).toContainText(/could not delete task/i);
  await expect(page.getByTestId('todo-item')).toHaveText(['Buy milk']);
  await expect(page.getByTestId('todo-empty')).toHaveCount(0);
});
