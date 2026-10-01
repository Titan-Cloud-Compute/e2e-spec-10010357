import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

  async setCompleted(ownerId: string, id: string, rawCompleted: unknown): Promise<TaskDto> {
    if (typeof rawCompleted !== 'boolean') {
      throw new BadRequestException('completed must be a boolean');
    }
    const result = await this.prisma.task.updateMany({
      where: { id, ownerId },
      data: { completed: rawCompleted },
    });
    if (result.count === 0) throw new NotFoundException('task not found');
    return this.prisma.task.findFirst({ where: { id, ownerId }, select: TASK_SELECT }) as Promise<TaskDto>;
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const result = await this.prisma.task.deleteMany({ where: { id, ownerId } });
    if (result.count === 0) throw new NotFoundException('task not found');
  }
}
