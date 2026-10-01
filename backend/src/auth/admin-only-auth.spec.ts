/**
 * admin_only auth model: there is no public self-signup and no public
 * registration-token preview; invite creation is restricted to ADMIN.
 */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { ROLES_KEY, RolesGuard } from './roles.guard';

const proto = AuthController.prototype as unknown as Record<string, unknown>;

function ctxFor(role: string): ExecutionContext {
  return {
    getHandler: () => proto.invite,
    getClass: () => AuthController,
    switchToHttp: () => ({ getRequest: () => ({ session: { userId: 'u1', role } }) }),
  } as unknown as ExecutionContext;
}

describe('admin_only auth model', () => {
  it('exposes no signup handler (POST api/auth/signup is not found)', () => {
    expect(proto.signup).toBeUndefined();
  });

  it('exposes no public registration-token preview', () => {
    expect(proto.previewRegistrationToken).toBeUndefined();
  });

  it('restricts invite creation to ADMIN', () => {
    expect(Reflect.getMetadata(ROLES_KEY, proto.invite as object)).toEqual(['ADMIN']);
  });

  it('RolesGuard forbids a non-admin from minting an invite', () => {
    const guard = new RolesGuard(new Reflector());
    expect(() => guard.canActivate(ctxFor('USER'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctxFor('MANAGER'))).toThrow(ForbiddenException);
  });

  it('RolesGuard allows an ADMIN to mint an invite', () => {
    const guard = new RolesGuard(new Reflector());
    expect(guard.canActivate(ctxFor('ADMIN'))).toBe(true);
  });
});
