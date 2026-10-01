/**
 * Story card: delete-todo — HTTP-level check for DELETE /api/tasks/:id.
 * The JWT guard is replaced by a stub that puts the session user (from the
 * x-test-user header) on req.session; Prisma is an in-memory fake.
 */
import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

class StubGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = req.headers['x-test-user'];
    if (user) req.session = { userId: String(user), role: 'USER', firmId: null };
    return true;
  }
}

interface Row { id: string; title: string; completed: boolean; createdAt: Date; ownerId: string }

describe('DELETE /api/tasks/:id', () => {
  let app: INestApplication;
  let rows: Row[];

  beforeEach(async () => {
    rows = [
      { id: 't1', title: 'Mine', completed: false, createdAt: new Date(), ownerId: 'u1' },
      { id: 't2', title: 'Theirs', completed: false, createdAt: new Date(), ownerId: 'u2' },
    ];
    const prisma = {
      task: {
        findMany: jest.fn(async ({ where }: any) => rows.filter(r => r.ownerId === where.ownerId)),
        deleteMany: jest.fn(async ({ where }: any) => {
          const before = rows.length;
          rows = rows.filter(r => !(r.id === where.id && r.ownerId === where.ownerId));
          return { count: before - rows.length };
        }),
      },
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: new TasksService(prisma as any) }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new StubGuard())
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("deletes the session user's task and the list is empty again", async () => {
    await request(app.getHttpServer()).delete('/api/tasks/t1').set('x-test-user', 'u1').expect(204);
    expect(rows.map(r => r.id)).toEqual(['t2']);
    const res = await request(app.getHttpServer()).get('/api/tasks').set('x-test-user', 'u1').expect(200);
    expect(res.body).toEqual([]);
  });

  it("returns 404 and keeps another user's task", async () => {
    await request(app.getHttpServer()).delete('/api/tasks/t2').set('x-test-user', 'u1').expect(404);
    expect(rows.map(r => r.id)).toEqual(['t1', 't2']);
  });

  it('returns 401 without a session', async () => {
    await request(app.getHttpServer()).delete('/api/tasks/t1').expect(401);
    expect(rows).toHaveLength(2);
  });
});
