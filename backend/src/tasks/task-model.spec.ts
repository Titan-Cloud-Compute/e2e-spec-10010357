/**
 * Schema contract for the Task domain model (foundation card).
 * Story cards (add/complete/delete-todo) build against this table.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Prisma } from '@prisma/client';

const PRISMA_DIR = join(__dirname, '..', '..', 'prisma');
const schema = readFileSync(join(PRISMA_DIR, 'schema.prisma'), 'utf8');
const migration = readFileSync(
  join(PRISMA_DIR, 'migrations', '0006_task', 'migration.sql'),
  'utf8',
);

function modelBlock(name: string): string {
  const m = schema.match(new RegExp(`^model ${name} \\{([\\s\\S]*?)^\\}`, 'm'));
  if (!m) throw new Error(`model ${name} not found`);
  return m[1];
}

describe('Task domain model', () => {
  const task = modelBlock('Task');

  it('declares the expected fields', () => {
    expect(task).toMatch(/\bid\s+String\s+@id\s+@default\(cuid\(\)\)/);
    expect(task).toMatch(/\btitle\s+String\b/);
    expect(task).toMatch(/\bcompleted\s+Boolean\s+@default\(false\)/);
    expect(task).toMatch(/\bownerId\s+String\b/);
    expect(task).toMatch(/\bowner\s+User\s+@relation\(fields: \[ownerId\], references: \[id\], onDelete: Cascade\)/);
    expect(task).toMatch(/\bcreatedAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(task).toMatch(/\bupdatedAt\s+DateTime\s+@updatedAt/);
    expect(task).toMatch(/@@index\(\[ownerId\]\)/);
  });

  it('User has the tasks back-relation', () => {
    expect(modelBlock('User')).toMatch(/\btasks\s+Task\[\]/);
  });

  it('0006_task migration creates the table, FK and index', () => {
    expect(migration).toContain('CREATE TABLE "Task"');
    expect(migration).toMatch(/"completed" BOOLEAN NOT NULL DEFAULT false/);
    expect(migration).toMatch(/FOREIGN KEY \("ownerId"\) REFERENCES "User"\("id"\) ON DELETE CASCADE/);
    expect(migration).toContain('CREATE INDEX "Task_ownerId_idx"');
  });

  it('generated Prisma client exposes the Task model', () => {
    expect(Prisma.ModelName.Task).toBe('Task');
    const fields = Object.keys(Prisma.TaskScalarFieldEnum);
    expect(fields).toEqual(
      expect.arrayContaining(['id', 'title', 'completed', 'ownerId', 'createdAt', 'updatedAt']),
    );
  });
});
