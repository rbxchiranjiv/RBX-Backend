import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ValidationError as DomainValidationError } from '../../services/errors';

type ClassType<T> = new (...args: any[]) => T;

export async function validateDto<T extends object>(cls: ClassType<T>, payload: unknown): Promise<T> {
  const instance = plainToInstance(cls, payload);
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length) {
    const messages = errors
      .map(error => Object.values(error.constraints ?? {}))
      .flat()
      .filter(Boolean);
    throw new DomainValidationError(messages.join('; ') || 'Validation failed');
  }
  return instance;
}
