import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { Pagination } from '@/common/pagination/pagination.types';
import type { Config } from '@/configs/environment.config';
import type {
  CreatePlanDto,
  UpdatePlanDto,
} from '@/modules/subscriptions/dto/plan.dto';
import { SubscriptionRepository } from '@/modules/subscriptions/repositories/subscription.repository';
import locals from '@/locals';

@Injectable()
export class PlanService {
  private readonly stripe: Stripe;

  constructor(
    private readonly subscriptions: SubscriptionRepository,
    config: ConfigService<Config>,
  ) {
    this.stripe = new Stripe(
      config.get<Config['stripe']>('stripe')?.secretKey ?? 'not-configured',
    );
  }

  async create(dto: CreatePlanDto) {
    const stripePriceId = await this.createStripePrice(dto);
    return this.subscriptions.createPlan({
      name: dto.name,
      driverLimit: dto.driverLimit,
      price: dto.price,
      currency: dto.currency.toLowerCase(),
      stripePriceId,
    });
  }

  list(pagination: Pagination) {
    return this.subscriptions.listPlans(pagination);
  }

  async update(id: string, dto: UpdatePlanDto) {
    const current = await this.subscriptions.findPlan(id);
    if (!current) {
      throw new NotFoundException(locals.subscriptions.plan_not_found);
    }

    const stripePriceId = await this.stripePriceIdForUpdate(current, dto);

    const plan = await this.subscriptions.revisePlan(id, {
      name: dto.name,
      driverLimit: dto.driverLimit,
      price: dto.price,
      currency: dto.currency?.toLowerCase(),
      stripePriceId,
    });
    if (!plan) throw new NotFoundException(locals.subscriptions.plan_not_found);
    return plan;
  }
  async remove(id: string) {
    if (!(await this.subscriptions.findPlan(id))) {
      throw new NotFoundException(locals.subscriptions.plan_not_found);
    }
    return this.subscriptions.deprecatePlan(id);
  }

  private async createStripePrice(dto: CreatePlanDto) {
    const product = await this.stripe.products.create({
      name: dto.name,
      metadata: { driverLimit: String(dto.driverLimit) },
    });
    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: dto.price,
      currency: dto.currency.toLowerCase(),
      recurring: { interval: 'month' },
    });
    return price.id;
  }

  private async stripePriceIdForUpdate(
    current: {
      name: string;
      stripePriceId: string;
      driverLimit: number;
      price: number;
      currency: string;
    },
    dto: UpdatePlanDto,
  ) {
    const priceChanged = dto.price !== undefined || dto.currency !== undefined;
    if (priceChanged) {
      return this.createStripePrice({
        name: dto.name ?? current.name,
        price: dto.price ?? current.price,
        currency: dto.currency ?? current.currency,
        driverLimit: dto.driverLimit ?? current.driverLimit,
      });
    }

    if (dto.name !== undefined || dto.driverLimit !== undefined) {
      await this.updateStripeProduct(current.stripePriceId, {
        name: dto.name ?? current.name,
        driverLimit: dto.driverLimit ?? current.driverLimit,
      });
    }

    return undefined;
  }

  private async updateStripeProduct(
    stripePriceId: string,
    dto: { name: string; driverLimit: number },
  ) {
    const price = await this.stripe.prices.retrieve(stripePriceId);
    const productId =
      typeof price.product === 'string' ? price.product : price.product.id;
    await this.stripe.products.update(productId, {
      name: dto.name,
      metadata: { driverLimit: String(dto.driverLimit) },
    });
  }
}
