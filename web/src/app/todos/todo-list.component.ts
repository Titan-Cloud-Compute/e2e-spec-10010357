import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiClient, ApiError, UnauthorizedError } from '../shared/api/api-client';
import { AuthService } from '../shared/auth.service';

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

@Component({
  selector: 'app-todo-list',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="todo-page">
      <h1>My tasks</h1>
      <form class="todo-form" data-testid="todo-form" (ngSubmit)="add()">
        <label for="todo-input" class="visually-hidden">New task</label>
        <input
          id="todo-input"
          data-testid="todo-input"
          type="text"
          name="title"
          [(ngModel)]="title"
          placeholder="What needs to be done?"
          autocomplete="off"
          maxlength="500"
        />
        <button type="submit" data-testid="todo-add" class="btn-primary" [disabled]="saving() || !title.trim()">Add</button>
      </form>
      @if (error()) {
        <p class="todo-error" role="alert" data-testid="todo-error">{{ error() }}</p>
      }
      @if (todos().length === 0) {
        <p class="todo-empty" data-testid="todo-empty">{{ loading() ? 'Loading tasks…' : 'No tasks yet. Add your first task above.' }}</p>
      } @else {
        <ul class="todo-list" data-testid="todo-list">
          @for (todo of todos(); track todo.id) {
            <li class="todo-item" data-testid="todo-item" [class.todo-item--completed]="todo.completed">
              <label class="todo-label">
                <input
                  type="checkbox"
                  data-testid="todo-toggle"
                  [checked]="todo.completed"
                  [disabled]="toggling().has(todo.id)"
                  (change)="toggle(todo)"
                  [attr.aria-label]="'Mark ' + todo.title + ' complete'"
                />
                <span class="todo-title" data-testid="todo-title">{{ todo.title }}</span>
              </label>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [`
    .todo-page { max-width: 640px; margin: 0 auto; padding: 2rem 1rem; }
    h1 { font-size: var(--font-size-xl); color: var(--color-text-primary); margin: 0 0 1rem; }
    .todo-form { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .todo-form input {
      flex: 1;
      padding: 0.625rem 0.75rem;
      font-size: var(--font-size-input, 1rem);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-btn);
      min-height: 44px;
    }
    .btn-primary {
      padding: 0.625rem 1.5rem;
      font-weight: 600;
      color: white;
      background: var(--color-primary);
      border: none;
      border-radius: var(--radius-btn);
      min-height: 44px;
      cursor: pointer;
    }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .todo-list { list-style: none; margin: 0; padding: 0; }
    .todo-item { padding: 0.75rem; border-bottom: 1px solid var(--color-border); color: var(--color-text-primary); }
    .todo-empty { color: var(--color-text-secondary); }
    .todo-error { color: var(--color-error); }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .todo-label { display: flex; align-items: center; gap: 0.75rem; min-height: 44px; cursor: pointer; }
    .todo-label input { width: 20px; height: 20px; }
    .todo-item--completed .todo-title { text-decoration: line-through; color: var(--color-text-secondary); }
  `],
})
export class TodoListComponent implements OnInit {
  private api = inject(ApiClient);
  private auth = inject(AuthService);
  private router = inject(Router);

  title = '';
  todos = signal<Todo[]>([]);
  loading = signal(true);
  saving = signal(false);
  toggling = signal<Set<string>>(new Set());
  error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      await this.reload();
    } catch (err) {
      if (!this.handleAuthError(err)) this.error.set(this.describe('Could not load tasks', err));
    } finally {
      this.loading.set(false);
    }
  }

  async add(): Promise<void> {
    const title = this.title.trim();
    if (!title || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const created = await this.api.post<Todo>('/api/tasks', { title });
      // Optimistic append first, so the task is visible even if the re-read fails.
      this.todos.update(list => [
        ...list,
        created && created.id ? created : { id: 'tmp-' + Date.now(), title, completed: false, createdAt: new Date().toISOString() },
      ]);
      this.title = '';
      try {
        const list = await this.api.get<Todo[]>('/api/tasks');
        if (Array.isArray(list) && list.some(t => t.title === title)) this.todos.set(list);
      } catch (err) {
        this.handleAuthError(err);
      }
    } catch (err) {
      if (!this.handleAuthError(err)) this.error.set(this.describe('Could not add task', err));
    } finally {
      this.saving.set(false);
    }
  }

  async toggle(todo: Todo): Promise<void> {
    const next = !todo.completed;
    // Optimistic update
    this.todos.update(list => list.map(t => t.id === todo.id ? { ...t, completed: next } : t));
    // Mark as in-flight
    this.toggling.update(s => new Set([...s, todo.id]));
    try {
      const updated = await this.api.patch<Todo>('/api/tasks/' + encodeURIComponent(todo.id), { completed: next });
      if (updated && updated.id) {
        this.todos.update(list => list.map(t => t.id === updated.id ? updated : t));
      }
    } catch (err) {
      // Revert on error
      this.todos.update(list => list.map(t => t.id === todo.id ? { ...t, completed: todo.completed } : t));
      if (!this.handleAuthError(err)) this.error.set(this.describe('Could not update task', err));
    } finally {
      this.toggling.update(s => { const n = new Set(s); n.delete(todo.id); return n; });
    }
  }

  private async reload(): Promise<void> {
    const list = await this.api.get<Todo[]>('/api/tasks');
    this.todos.set(Array.isArray(list) ? list : []);
  }

  /** Stale local session (cookie gone): sign out and send the user to log in again. */
  private handleAuthError(err: unknown): boolean {
    if (!(err instanceof UnauthorizedError)) return false;
    this.auth.signOut();
    void this.router.navigate(['/login'], { queryParams: { returnUrl: '/' } });
    return true;
  }

  private describe(prefix: string, err: unknown): string {
    if (err instanceof ApiError) return `${prefix} (${err.status}): ${err.message}`;
    if (err instanceof Error && err.message) return `${prefix}: ${err.message}`;
    return `${prefix}.`;
  }
}
