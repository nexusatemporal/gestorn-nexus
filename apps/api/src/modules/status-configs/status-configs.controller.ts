import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UsePipes,
} from '@nestjs/common';
import { StatusConfigsService } from './status-configs.service';
import { CreateStatusConfigDto, CreateStatusConfigSchema } from './dto/create-status-config.dto';
import { UpdateStatusConfigDto, UpdateStatusConfigSchema } from './dto/update-status-config.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole, StatusEntity } from '@prisma/client';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

@Controller('status-configs')
export class StatusConfigsController {
  constructor(private readonly service: StatusConfigsService) {}

  /**
   * GET /status-configs?entity=CLIENT
   * Lista status configs — todos usuários autenticados
   */
  @Get()
  async findAll(@Query('entity') entity?: StatusEntity) {
    return this.service.findAll(entity);
  }

  /**
   * GET /status-configs/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /**
   * POST /status-configs
   * Cria novo status customizado — SUPERADMIN ou ADMINISTRATIVO
   */
  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  @UsePipes(new ZodValidationPipe(CreateStatusConfigSchema))
  async create(@Body() dto: CreateStatusConfigDto) {
    return this.service.create(dto);
  }

  /**
   * PUT /status-configs/:id
   * Edita label/cor (sistema) ou todos os campos (custom) — SUPERADMIN ou ADMINISTRATIVO
   */
  @Put(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  @UsePipes(new ZodValidationPipe(UpdateStatusConfigSchema))
  async update(@Param('id') id: string, @Body() dto: UpdateStatusConfigDto) {
    return this.service.update(id, dto);
  }

  /**
   * DELETE /status-configs/:id
   * Desativa status custom — apenas SUPERADMIN (sistema não pode deletar)
   */
  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
  }
}
