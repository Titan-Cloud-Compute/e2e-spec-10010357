/**
 * Story card: complete-todo
 *   GIVEN the to-do list has one incomplete task
 *   WHEN the user marks the task complete
 *   THEN the task is shown as completed
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
    // PATCH /api/tasks/:id — toggle completion
    const patchMatch = apiPath.match(/^tasks\/(.+)$/);
    if (patchMatch && method === 'PATCH') {
      if (!store.user) return json({ message: 'Unauthorized' }, 401);
      const id = decodeURIComponent(patchMatch[1]);
      const idx = tasks.findIndex(t => t.id === id);
      if (idx === -1) return json({ message: 'Not found' }, 404);
      const body = req.postDataJSON() as { completed?: boolean };
      tasks[idx] = { ...tasks[idx], completed: body.completed ?? tasks[idx].completed };
      return json(tasks[idx]);
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

test('user completes a task — row gets completed class and line-through style', async ({ page }) => {
  const tasks: MockTask[] = [
    { id: 't1', title: 'Buy milk', completed: false, createdAt: new Date().toISOString() },
  ];
  await mockApi(page, tasks);
  await login(page);

  await page.goto('/#/');
  const item = page.getByTestId('todo-item');
  await expect(item).toHaveCount(1);

  // Initially unchecked, no completed class
  const toggle = item.getByTestId('todo-toggle');
  await expect(toggle).not.toBeChecked();
  await expect(item).not.toHaveClass(/todo-item--completed/);

  // Click the checkbox
  await toggle.click();

  // After toggle: checkbox checked, class applied, line-through text-decoration
  await expect(toggle).toBeChecked();
  await expect(item).toHaveClass(/todo-item--completed/);
  const titleSpan = item.getByTestId('todo-title');
  const textDecoration = await titleSpan.evaluate(el => getComputedStyle(el).textDecoration);
  expect(textDecoration).toContain('line-through');

  // Mock store task has been updated
  expect(tasks[0].completed).toBe(true);
});

test('completed state persists after page reload', async ({ page }) => {
  const tasks: MockTask[] = [
    { id: 't1', title: 'Buy milk', completed: false, createdAt: new Date().toISOString() },
  ];
  await mockApi(page, tasks);
  await login(page);

  await page.goto('/#/');
  const toggle = page.getByTestId('todo-toggle');
  await toggle.click();
  await expect(toggle).toBeChecked();

  // Reload the page — tasks array now has completed:true so mock returns it
  await page.goto('/#/');
  await expect(page.getByTestId('todo-toggle')).toBeChecked();
  await expect(page.getByTestId('todo-item')).toHaveClass(/todo-item--completed/);
});
