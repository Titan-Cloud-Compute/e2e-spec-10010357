import { Component } from '@angular/core';
import { TodoListComponent } from '../todos/todo-list.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TodoListComponent],
  template: `
    <div class="dashboard-page" data-placeholder>
      <app-todo-list></app-todo-list>
    </div>
  `,
})
export class DashboardComponent {}
