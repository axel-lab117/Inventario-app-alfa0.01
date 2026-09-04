import { Injectable, PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    const schema = (metadata.metatype as any)?.schema as ZodSchema | undefined;

    if (!schema) return value;

    try {
      return schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        throw new BadRequestException({
          message: 'Validation failed',
          errors: validationError.details,
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}

export function ZodDto(schema: ZodSchema) {
  class ZodDtoClass {
    static schema = schema;
    constructor(data: unknown) {
      Object.assign(this, schema.parse(data));
    }
  }
  return ZodDtoClass;
}