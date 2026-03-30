import { z } from 'zod';
import { FormPurpose, ProductType, VendorAssignmentMode } from '@prisma/client';

/// Definição de um campo do formulário (armazenado em Form.fields como JSON)
const FormFieldDefSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'text', 'email', 'phone', 'cnpj', 'cep', 'select', 'textarea',
    'number', 'state', 'date', 'url', 'radio', 'checkbox', 'heading', 'hidden',
  ]),
  label: z.string().min(1).max(100),
  placeholder: z.string().max(200).optional(),
  description: z.string().max(300).optional(),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(), // para type='select', 'radio', 'checkbox'
  mappedTo: z
    .enum(['name', 'email', 'phone', 'cpfCnpj', 'companyName', 'city', 'role', 'notes'])
    .optional(),
  order: z.number().int().min(0),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
  halfWidth: z.boolean().optional(),
  defaultValue: z.string().max(500).optional(),
});

export const CreateFormSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(200),

  description: z.string().max(1000).optional().nullable(),

  purpose: z.nativeEnum(FormPurpose),

  productType: z.nativeEnum(ProductType).optional().nullable(),

  fields: z.array(FormFieldDefSchema).default([]),

  successMessage: z
    .string()
    .max(300)
    .optional()
    .nullable()
    .default('Obrigado! Entraremos em contato em breve.'),

  vendorAssignmentMode: z.nativeEnum(VendorAssignmentMode).default(VendorAssignmentMode.CREATOR),

  defaultVendedorId: z
    .string()
    .min(1)
    .optional()
    .nullable(),

  roundRobinVendedorIds: z.array(z.string()).default([]),

  originId: z
    .string()
    .min(1)
    .optional()
    .nullable(),

  isActive: z.boolean().default(true),

  /// Slug opcional — se não enviado, backend gera automaticamente do nome
  slug: z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens')
    .optional(),
});

export type CreateFormDto = z.infer<typeof CreateFormSchema>;
export type FormFieldDef = z.infer<typeof FormFieldDefSchema>;

export const UpdateFormSchema = CreateFormSchema.partial();
export type UpdateFormDto = z.infer<typeof UpdateFormSchema>;
