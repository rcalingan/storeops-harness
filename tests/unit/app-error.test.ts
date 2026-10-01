import {
  AppError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  isAppError,
} from '../../src/shared/errors';

describe('AppError hierarchy', () => {
  it.each([
    [new ValidationError(), 'VALIDATION_ERROR', 400],
    [new UnauthorizedError(), 'UNAUTHORIZED', 401],
    [new ForbiddenError(), 'FORBIDDEN', 403],
    [new NotFoundError('Activity', 'a1'), 'NOT_FOUND', 404],
    [new ConflictError('dup'), 'CONFLICT', 409],
    [new InternalError(), 'INTERNAL_ERROR', 500],
  ])('%p has code %s and status %d', (error, code, status) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(code);
    expect(error.statusCode).toBe(status);
    expect(isAppError(error)).toBe(true);
  });

  it('formats NotFound messages with and without an id', () => {
    expect(new NotFoundError('Activity', 'a1').message).toBe("Activity 'a1' not found");
    expect(new NotFoundError('Activity').message).toBe('Activity not found');
  });

  it('serialises details only when present', () => {
    expect(new ValidationError('bad', [{ path: 'x' }]).toBody()).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'bad', details: [{ path: 'x' }] },
    });
    expect(new ForbiddenError('no').toBody()).toEqual({ error: { code: 'FORBIDDEN', message: 'no' } });
  });

  it('preserves the subclass name', () => {
    expect(new ConflictError('x').name).toBe('ConflictError');
    expect(isAppError(new Error('raw'))).toBe(false);
  });
});
