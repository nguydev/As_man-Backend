import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import Stripe from 'stripe';
import type { Config } from '@/configs/environment.config';
import {
  STRIPE_JOB_PROCESS,
  STRIPE_QUEUE,
} from '@/infrastructure/queue/queue.constants';
import locals from '@/locals';

@Injectable()
export class StripeWebhookService {
  private readonly stripe: Stripe;
  constructor(
    config: ConfigService<Config>,
    @InjectQueue(STRIPE_QUEUE) private readonly queue: Queue,
  ) {
    const stripe = config.get<Config['stripe']>('stripe');
    this.stripe = new Stripe(stripe?.secretKey ?? 'not-configured');
    this.webhookSecret = stripe?.webhookSecret;
  }
  private readonly webhookSecret?: string;

  async receive(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!this.webhookSecret)
      throw new ServiceUnavailableException(
        locals.subscriptions.stripe_not_configured,
      );
    if (!rawBody || !signature)
      throw new BadRequestException(locals.subscriptions.invalid_webhook);
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch {
      throw new BadRequestException(locals.subscriptions.invalid_webhook);
    }
    await this.queue.add(STRIPE_JOB_PROCESS, event, { jobId: event.id });
    return { received: true };
  }
}
