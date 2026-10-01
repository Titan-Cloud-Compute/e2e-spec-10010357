import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

function makePrisma() {
  return {
    task: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 't1', title: data.title, completed: false, createdAt: new Date() }),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue({ id: 't1', title: 'x', completed: true, createdAt: new Date() }),
    },
  };
}

describe('TasksService', () => {
  it('lists only the owner tasks in createdAt order', async () => {
    const prisma = makePrisma();
    const svc = new TasksService(prisma as any);
    await svc.list('u1');
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'u1' }, orderBy: { createdAt: 'asc' } }),
    );
  });

  it('creates a trimmed task owned by the user', async () => {
    const prisma = makePrisma();
    const svc = new TasksService(prisma as any);
    const t = await svc.create('u1', '  Buy milk  ');
    expect(t.title).toBe('Buy milk');
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { title: 'Buy milk', ownerId: 'u1' } }),
    );
  });

  it('rejects an empty or missing title', () => {
    const svc = new TasksService(makePrisma() as any);
    expect(() => svc.create('u1', '   ')).toThrow(BadRequestException);
    expect(() => svc.create('u1', undefined)).toThrow(BadRequestException);
  });
});

describe('TasksService.setCompleted', () => {
  it('calls updateMany with owner-scoped where and returns updated task', async () => {
    const prisma = makePrisma();
    const svc = new TasksService(prisma as any);
    const result = await svc.setCompleted('u1', 't1', true);
    expect(prisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1', ownerId: 'u1' }, data: { completed: true } }),
    );
    expect(result.completed).toBe(true);
  });

  it('rejects non-boolean completed values', async () => {
    const svc = new TasksService(makePrisma() as any);
    await expect(svc.setCompleted('u1', 't1', 'yes')).rejects.toThrow(BadRequestException);
    await expect(svc.setCompleted('u1', 't1', undefined)).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when count is 0 (missing or wrong owner)', async () => {
    const prisma = makePrisma();
    prisma.task.updateMany.mockResolvedValue({ count: 0 });
    const svc = new TasksService(prisma as any);
    await expect(svc.setCompleted('u1', 'missing', true)).rejects.toThrow(NotFoundException);
  });
});

describe('TasksController', () => {
  it('scopes GET and POST to the session user', async () => {
    const prisma = makePrisma();
    const ctrl = new TasksController(new TasksService(prisma as any));
    const req = { session: { userId: 'u9', role: 'USER', firmId: null } } as any;
    await ctrl.list(req);
    expect(prisma.task.findMany.mock.calls[0][0].where).toEqual({ ownerId: 'u9' });
    await ctrl.create(req, { title: 'x' });
    expect(prisma.task.create.mock.calls[0][0].data).toEqual({ title: 'x', ownerId: 'u9' });
  });

  it('passes the session userId as ownerId to setCompleted', async () => {
    const prisma = makePrisma();
    const ctrl = new TasksController(new TasksService(prisma as any));
    const req = { session: { userId: 'u9', role: 'USER', firmId: null } } as any;
    await ctrl.update(req, 't1', { completed: true });
    expect(prisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1', ownerId: 'u9' } }),
    );
  });

  it('rejects requests without a session', () => {
    const ctrl = new TasksController(new TasksService(makePrisma() as any));
    expect(() => ctrl.list({} as any)).toThrow(UnauthorizedException);
  });
});

describe('TasksService.remove', () => {
  it('deletes with an owner-scoped where', async () => {
    const prisma = makePrisma();
    const svc = new TasksService(prisma as any);
    await svc.remove('u1', 't1');
    expect(prisma.task.deleteMany).toHaveBeenCalledWith({ where: { id: 't1', ownerId: 'u1' } });
  });

  it('throws NotFoundException when nothing was deleted (missing or wrong owner)', async () => {
    const prisma = makePrisma();
    prisma.task.deleteMany.mockResolvedValue({ count: 0 });
    const svc = new TasksService(prisma as any);
    await expect(svc.remove('u1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('controller passes the session userId as ownerId', async () => {
    const prisma = makePrisma();
    const ctrl = new TasksController(new TasksService(prisma as any));
    const req = { session: { userId: 'u9', role: 'USER', firmId: null } } as any;
    await ctrl.remove(req, 't1');
    expect(prisma.task.deleteMany).toHaveBeenCalledWith({ where: { id: 't1', ownerId: 'u9' } });
  });
});
