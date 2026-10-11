import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { STRIPE_QUEUE } from '@/infrastructure/queue/queue.constants';
import { MembershipsModule } from '@/modules/memberships/memberships.module';
import { StripeProcessor } from '@/modules/subscriptions/processors/stripe.processor';
import { SubscriptionRepository } from '@/modules/subscriptions/repositories/subscription.repository';
import { PlanService } from '@/modules/subscriptions/services/plan.service';
import { StripeWebhookService } from '@/modules/subscriptions/services/stripe-webhook.service';
import { OrganizationSubscriptionService } from '@/modules/subscriptions/services/organization-subscription.service';
import { SubscriptionsController } from '@/modules/subscriptions/subscriptions.controller';
import { AdminSubscriptionsController } from '@/modules/subscriptions/admin-subscriptions.controller';
import { AdminSubscriptionService } from '@/modules/subscriptions/services/admin-subscription.service';

@Module({
  imports: [
    AuthModule,
    MembershipsModule,
    BullModule.registerQueue({ name: STRIPE_QUEUE }),
  ],
  controllers: [SubscriptionsController, AdminSubscriptionsController],
  providers: [
    SubscriptionRepository,
    PlanService,
    AdminSubscriptionService,
    StripeWebhookService,
    StripeProcessor,
    OrganizationSubscriptionService,
  ],
  exports: [SubscriptionRepository],
})
export class SubscriptionsModule {}
