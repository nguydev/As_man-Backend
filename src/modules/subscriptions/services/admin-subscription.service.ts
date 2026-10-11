import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { Pagination } from '@/common/pagination/pagination.types';
import type { Config } from '@/configs/environment.config';
import type { ListAdminSubscriptionsDto } from '@/modules/subscriptions/dto/admin-subscription.dto';
import {
  SubscriptionRepository,
  type SubscriptionRevenueSource,
} from '@/modules/subscriptions/repositories/subscription.repository';
import locals from '@/locals';

@Injectable()
export class AdminSubscriptionService {
  private readonly stripe: Stripe;

  constructor(
    private readonly subscriptions: SubscriptionRepository,
    config: ConfigService<Config>,
  ) {
    this.stripe = new Stripe(
      config.get<Config['stripe']>('stripe')?.secretKey ?? 'not-configured',
    );
  }

  list(pagination: Pagination, filters: ListAdminSubscriptionsDto) {
    return this.subscriptions.listSubscriptions(pagination, filters);
  }

  async stats() {
    const source = await this.subscriptions.statsSource();
    const currentMrr = this.monthlyRecurringRevenue(source.currentMrr);
    const previousMrr = this.monthlyRecurringRevenue(source.previousMrr);
    const churnBase = source.activeSubscribers + source.churned;

    return {
      monthlyRecurringRevenue: {
        amount: currentMrr.amount,
        currency: currentMrr.currency,
        changePercentVsLastMonth: this.percentChange(
          currentMrr.amount,
          previousMrr.amount,
        ),
      },
      activeSubscribers: {
        total: source.activeSubscribers,
        newToday: source.newToday,
      },
      churnRate: {
        rate: churnBase ? source.churned / churnBase : 0,
        churned: source.churned,
      },
    };
  }

  async get(id: string) {
    const subscription = await this.subscriptions.findSubscription(id);
    if (!subscription) {
      throw new NotFoundException(locals.subscriptions.subscription_not_found);
    }
    return subscription;
  }

  async cancel(id: string) {
    const subscription = await this.get(id);
    await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    return this.subscriptions.cancelSubscription(id);
  }

  async reactivate(id: string) {
    const subscription = await this.get(id);
    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });
    return this.subscriptions.activateSubscription(id);
  }

  private monthlyRecurringRevenue(subscriptions: SubscriptionRevenueSource[]) {
    let amount = 0;
    let currency = 'usd';

    for (const subscription of subscriptions) {
      currency = subscription.plan.currency;
      amount += subscription.plan.price;
    }

    return { amount, currency };
  }

  private percentChange(current: number, previous: number) {
    if (!previous) return current ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(2));
  }
}
