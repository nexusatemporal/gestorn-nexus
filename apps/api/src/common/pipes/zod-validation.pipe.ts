import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/**
 * Zod Validation Pipe
 * Valida o payload usando schemas Zod
 *
 * @example
 * @Post()
 * @UsePipes(new ZodValidationPipe(CreateUserSchema))
 * async create(@Body() dto: CreateUserDto) {
 *   return this.service.create(dto);
 * }
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  private readonly logger = new Logger(ZodValidationPipe.name);

  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    this.logger.debug(
      `🔍 Validating ${metadata.type} - Data: ${JSON.stringify(value)}`
    );

    try {
      const parsedValue = this.schema.parse(value);
      this.logger.debug(`✅ Validation passed`);
      return parsedValue;
    } catch (error) {
      if (error instanceof ZodError) {
        this.logger.error(
          `❌ ZOD VALIDATION FAILED:\n` +
          `  Input: ${JSON.stringify(value, null, 2)}\n` +
          `  Errors: ${JSON.stringify(error.errors, null, 2)}`
        );

        // Formatar erros do Zod para resposta amigável
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        throw new BadRequestException({
          message: 'Validation failed',
          errors: formattedErrors,
        });
      }
      this.logger.error(`❌ Unknown validation error: ${error}`);
      throw new BadRequestException('Validation failed');
    }
  }
}
