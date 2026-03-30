import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FormsService } from './forms.service';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { UserRole } from '@prisma/client';
import { CreateFormSchema, CreateFormDto, UpdateFormSchema, UpdateFormDto } from './dto/create-form.dto';
import { SubmitFormSchema, SubmitFormDto, LPSubmitSchema, LPSubmitDto } from './dto/submit-form.dto';
import { Request } from 'express';

interface AuthUser {
  id: string;
  role: UserRole;
}

@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  // ════════════════════════════════════════════════════════════════
  // Endpoints autenticados
  // ════════════════════════════════════════════════════════════════

  @Get()
  async findAll(@CurrentUser() user: AuthUser) {
    return this.formsService.findAll(user.id, user.role);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.formsService.findOne(id, user.id, user.role);
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateFormSchema)) dto: CreateFormDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.formsService.create(dto, user.id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateFormSchema)) dto: UpdateFormDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.formsService.update(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.formsService.remove(id, user.id, user.role);
  }

  @Get(':id/submissions')
  async getSubmissions(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.formsService.getSubmissions(
      id,
      user.id,
      user.role,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  // ════════════════════════════════════════════════════════════════
  // Endpoints públicos — sem autenticação
  // ════════════════════════════════════════════════════════════════

  @Public()
  @Get('public/:slug')
  async getPublic(@Param('slug') slug: string) {
    return this.formsService.getPublic(slug);
  }

  @Public()
  @Post('public/:slug/submit')
  @HttpCode(HttpStatus.OK)
  async submitPublic(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(SubmitFormSchema)) dto: SubmitFormDto,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      undefined;

    return this.formsService.submitPublic(slug, dto.data, ip);
  }

  /**
   * Endpoint dedicado para Landing Pages externas.
   * Aceita campos nomeados (nome, whatsapp, clinica, cidade, etc.)
   * e cria o lead diretamente no pipeline.
   */
  @Public()
  @Post('public/:slug/lp-submit')
  @HttpCode(HttpStatus.OK)
  async submitFromLP(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(LPSubmitSchema)) dto: LPSubmitDto,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      undefined;

    return this.formsService.submitFromLP(slug, dto, ip);
  }
}
