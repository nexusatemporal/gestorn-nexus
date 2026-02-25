import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscriptions.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, BillingCycle } from '@prisma/client';

@Controller('subscriptions')
@UseGuards(RolesGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('client/:clientId')
  async getByClient(@Param('clientId') clientId: string) {
    return this.subscriptionService.getByClientId(clientId);
  }

  @Get('client/:clientId/active')
  async getActive(@Param('clientId') clientId: string) {
    return this.subscriptionService.getActive(clientId);
  }

  @Post('reactivate')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO, UserRole.GESTOR, UserRole.VENDEDOR)
  async reactivate(
    @Body() body: {
      clientId: string;
      planId: string;
      billingCycle: BillingCycle;
      newPaymentDate: string;
      amount: number;
    },
    @CurrentUser() user: any,
  ) {
    return this.subscriptionService.reactivate({
      ...body,
      userId: user.id,
    });
  }
}
