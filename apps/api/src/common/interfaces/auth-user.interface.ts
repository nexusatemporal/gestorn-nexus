import { UserRole } from '@prisma/client';

/**
 * Interface do usuário autenticado (v2.54.0 - Auth próprio JWT)
 * Substitui ClerkUser — sem clerkId
 * Anexado ao request após validação do token JWT
 */
export interface AuthUser {
  id: string;       // ID do usuário no banco local
  email: string;
  name: string;
  avatar?: string | null;
  role: UserRole;
  isActive: boolean;
}
