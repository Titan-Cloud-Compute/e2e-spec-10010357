import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../shared/api/api-client';

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
            <li class="todo-item" data-testid="todo-item">{{ todo.title }}</li>
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
  `],
})
export class TodoListComponent implements OnInit {
  private api = inject(ApiClient);

  title = '';
  todos = signal<Todo[]>([]);
  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const list = await this.api.get<Todo[]>('/api/tasks');
      this.todos.set(Array.isArray(list) ? list : []);
    } catch {
      this.error.set('Could not load tasks.');
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
      this.todos.update(list => [...list, created && created.id ? created : { id: 'tmp-' + Date.now(), title, completed: false, createdAt: new Date().toISOString() }]);
      this.title = '';
    } catch {
      this.error.set('Could not add task.');
    } finally {
      this.saving.set(false);
    }
  }
}
