import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';

export async function validateDto<T extends object>(
  dtoClass: new () => T,
  data: any,
): Promise<T> {
  const dto = plainToInstance(dtoClass, data);
  const errors = await validate(dto);

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error: ValidationError) => {
        const constraints = error.constraints;
        return constraints ? Object.values(constraints).join(', ') : 'Validation error';
      })
      .join('; ');
    
    throw new Error(errorMessages);
  }

  return dto;
}
