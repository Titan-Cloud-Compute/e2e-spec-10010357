import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TaskDto {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}

const TASK_SELECT = { id: true, title: true, completed: true, createdAt: true } as const;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  list(ownerId: string): Promise<TaskDto[]> {
    return this.prisma.task.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
      select: TASK_SELECT,
    });
  }

  create(ownerId: string, rawTitle: unknown): Promise<TaskDto> {
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
    if (!title) throw new BadRequestException('title is required');
    if (title.length > 500) throw new BadRequestException('title is too long');
    return this.prisma.task.create({
      data: { title, ownerId },
      select: TASK_SELECT,
    });
  }
}
