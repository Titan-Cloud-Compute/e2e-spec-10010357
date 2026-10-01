import { Body, Controller, Get, Param, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TasksService, TaskDto } from './tasks.service';

@UseGuards(JwtAuthGuard)
@Controller('api/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  private ownerId(req: Request): string {
    const userId = req.session?.userId;
    if (!userId) throw new UnauthorizedException();
    return userId;
  }

  @Get()
  list(@Req() req: Request): Promise<TaskDto[]> {
    return this.tasks.list(this.ownerId(req));
  }

  @Post()
  create(@Req() req: Request, @Body() body: { title?: unknown }): Promise<TaskDto> {
    return this.tasks.create(this.ownerId(req), body?.title);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { completed?: unknown },
  ): Promise<TaskDto> {
    return this.tasks.setCompleted(this.ownerId(req), id, body?.completed);
  }
}
