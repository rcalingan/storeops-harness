import type { z } from 'zod';
import { ValidationError } from '../errors';

/** Parses untrusted request input with a zod schema, raising a typed ValidationError on failure. */
export const parseOrThrow = <T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      'Request validation failed',
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
};
