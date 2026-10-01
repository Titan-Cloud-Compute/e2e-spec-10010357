import { Component } from '@angular/core';
import { TodoListComponent } from '../todos/todo-list.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TodoListComponent],
  template: `
    <app-todo-list></app-todo-list>
  `,
})
export class DashboardComponent {}
