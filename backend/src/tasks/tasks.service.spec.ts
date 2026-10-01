import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

function makePrisma() {
  return {
    task: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 't1', title: data.title, completed: false, createdAt: new Date() }),
      ),
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

  it('rejects requests without a session', () => {
    const ctrl = new TasksController(new TasksService(makePrisma() as any));
    expect(() => ctrl.list({} as any)).toThrow(UnauthorizedException);
  });
});
