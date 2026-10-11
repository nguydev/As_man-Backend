import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import type Stripe from 'stripe';
import StripeClient from 'stripe';
import type { SubStatus } from '@prisma-client';
import type { Config } from '@/configs/environment.config';
import { STRIPE_QUEUE } from '@/infrastructure/queue/queue.constants';
import { SubscriptionRepository } from '@/modules/subscriptions/repositories/subscription.repository';

@Injectable()
@Processor(STRIPE_QUEUE)
export class StripeProcessor extends WorkerHost {
  private readonly stripe: StripeClient;

  constructor(
    private readonly subscriptions: SubscriptionRepository,
    config: ConfigService<Config>,
  ) {
    super();
    this.stripe = new StripeClient(
      config.get<Config['stripe']>('stripe')?.secretKey ?? 'not-configured',
    );
  }
  async process(job: Job<Stripe.Event>): Promise<void> {
    const event = job.data;
    const object = event.data.object as unknown as Record<string, unknown>;
    const stripeSubscriptionId = this.subscriptionId(object);
    const subscription =
      event.type === 'checkout.session.completed' && stripeSubscriptionId
        ? ((await this.stripe.subscriptions.retrieve(
            stripeSubscriptionId,
          )) as unknown as Record<string, unknown>)
        : object;
    const metadata = {
      ...((object.metadata ?? {}) as Record<string, string>),
      ...((subscription.metadata ?? {}) as Record<string, string>),
    };
    const status = this.status(event.type, subscription.status);
    const period = this.periodEnd(subscription);
    await this.subscriptions.processStripeEvent({
      eventId: event.id,
      eventType: event.type,
      stripeSubscriptionId,
      organizationId: metadata.organizationId,
      planId: metadata.planId,
      status,
      currentPeriodEnd: period,
    });
  }
  private subscriptionId(object: Record<string, unknown>): string | undefined {
    const value =
      object.object === 'subscription' ? object.id : object.subscription;
    return typeof value === 'string' ? value : undefined;
  }
  private periodEnd(object: Record<string, unknown>): Date | undefined {
    const items = object.items as
      { data?: Array<{ current_period_end?: number }> } | undefined;
    const value =
      object.current_period_end ?? items?.data?.[0]?.current_period_end;
    return typeof value === 'number' ? new Date(value * 1000) : undefined;
  }
  private status(type: string, value: unknown): SubStatus | undefined {
    if (type === 'customer.subscription.deleted') return 'CANCELED';
    if (type === 'invoice.payment_failed') return 'PAST_DUE';
    const map: Record<string, SubStatus> = {
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      incomplete: 'INCOMPLETE',
    };
    return typeof value === 'string' ? map[value] : undefined;
  }
}
