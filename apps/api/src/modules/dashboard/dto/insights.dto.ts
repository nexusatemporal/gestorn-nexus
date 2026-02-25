import { z } from 'zod';

/**
 * ✅ v2.49.0: Severidade dos insights de IA
 */
export enum InsightSeverity {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/**
 * ✅ v2.49.0: Schema de validação para insight individual
 * ✅ v2.49.2: Transform severity to lowercase (IA returns UPPERCASE)
 */
export const DashboardInsightSchema = z.object({
  severity: z
    .string()
    .transform((val) => val.toLowerCase())
    .pipe(z.nativeEnum(InsightSeverity)),
  title: z.string().min(5).max(100),
  description: z.string().min(20).max(500),
  actionable: z.string().min(10).max(300).optional(),
});

/**
 * ✅ v2.49.0: Interface para insight individual
 */
export interface DashboardInsight {
  severity: InsightSeverity;
  title: string;
  description: string;
  actionable?: string;
}

/**
 * ✅ v2.49.0: DTO de resposta do endpoint /insights
 * ✅ v2.53.0: Adicionado cachedAt para tracking de cache
 */
export interface GenerateInsightsResponseDto {
  insights: DashboardInsight[];
  metadata: {
    generatedAt: string;
    period: string;
    product?: string;
    cached: boolean;
    cachedAt?: string; // ✅ v2.53.0: Timestamp do cache (ISO string)
  };
}
