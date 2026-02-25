/**
 * 📦 SALES AI - DTOs (Data Transfer Objects)
 */

import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsNumber,
  IsObject,
  ValidateNested,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// ========================================
// LEAD CONTEXT DTO
// ========================================

export class LeadContextDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(['DOMINANTE', 'INFLUENTE', 'ESTAVEL', 'CONSCIENTE', 'HIBRIDO'])
  disc?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  leadScore?: number;

  @IsEnum(['PROSPECCAO', 'QUALIFICACAO', 'APRESENTACAO', 'NEGOCIACAO', 'FECHAMENTO', 'POS_VENDA'])
  stage: string;

  @IsEnum(['ONE_NEXUS', 'NEXLOC'])
  product: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pains?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsString()
  budget?: string;

  @IsOptional()
  @IsString()
  timeline?: string;

  @IsOptional()
  @IsString()
  companySize?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  currentSolution?: string;

  @IsOptional()
  @IsString()
  lastContact?: string;

  @IsOptional()
  @IsNumber()
  interactions?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ========================================
// CHAT DTOs
// ========================================

export class ChatMessageDto {
  @IsString()
  id: string;

  @IsEnum(['user', 'assistant'])
  role: string;

  @IsString()
  content: string;

  @IsDateString()
  timestamp: string;

  @IsOptional()
  @IsString()
  leadId?: string;
}

export class ChatRequestDto {
  @IsString()
  message: string;

  @ValidateNested()
  @Type(() => LeadContextDto)
  leadContext: LeadContextDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];

  @IsOptional()
  @IsEnum(['groq', 'gemini', 'openai'])
  provider?: string;
}

// ========================================
// DISC ANALYSIS DTO
// ========================================

export class DISCAnalysisRequestDto {
  @ValidateNested()
  @Type(() => LeadContextDto)
  leadContext: LeadContextDto;
}

// ========================================
// BRIEFING DTO
// ========================================

export class BriefingRequestDto {
  @ValidateNested()
  @Type(() => LeadContextDto)
  leadContext: LeadContextDto;

  @IsOptional()
  @IsEnum(['discovery', 'demo', 'negotiation', 'closing'])
  callType?: string;
}

// ========================================
// BATTLECARD DTO
// ========================================

export class BattlecardRequestDto {
  @ValidateNested()
  @Type(() => LeadContextDto)
  leadContext: LeadContextDto;

  @IsString()
  competitor: string;
}

// ========================================
// ROLEPLAY DTOs
// ========================================

export class RoleplayPersonaDto {
  @IsString()
  name: string;

  @IsString()
  role: string;

  @IsEnum(['DOMINANTE', 'INFLUENTE', 'ESTAVEL', 'CONSCIENTE'])
  disc: string;

  @IsArray()
  @IsString({ each: true })
  objections: string[];
}

export class RoleplayScenarioDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(['FACIL', 'MEDIO', 'DIFICIL'])
  difficulty: string;

  @ValidateNested()
  @Type(() => RoleplayPersonaDto)
  persona: RoleplayPersonaDto;
}

export class RoleplayMessageDto {
  @IsString()
  id: string;

  @IsEnum(['vendedor', 'cliente', 'coach'])
  role: string;

  @IsString()
  content: string;

  @IsDateString()
  timestamp: string;

  @IsOptional()
  @IsObject()
  feedback?: {
    score: number;
    strengths: string[];
    improvements: string[];
  };
}

export class RoleplayRequestDto {
  @ValidateNested()
  @Type(() => RoleplayScenarioDto)
  scenario: RoleplayScenarioDto;

  @IsString()
  message: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleplayMessageDto)
  history: RoleplayMessageDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => LeadContextDto)
  leadContext?: LeadContextDto;
}

// ========================================
// GENERATOR DTO
// ========================================

export class GeneratorRequestDto {
  @IsEnum([
    'pitch-60s',
    'email-cold',
    'email-followup',
    'whatsapp-first',
    'whatsapp-followup',
    'script-discovery',
    'objection-response',
    'proposal',
  ])
  type: string;

  @ValidateNested()
  @Type(() => LeadContextDto)
  leadContext: LeadContextDto;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}

// ========================================
// FEEDBACK DTO
// ========================================

export class FeedbackRequestDto {
  @IsString()
  messageId: string;

  @IsEnum(['helpful', 'not_helpful'])
  rating: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LeadContextDto)
  leadContext?: LeadContextDto;
}

// ========================================
// ANALYTICS DTO
// ========================================

export class AnalyticsRequestDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
