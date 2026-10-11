import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { BatchResponse } from 'firebase-admin/messaging';
import type { Config } from '@/configs/environment.config';

const FCM_MULTICAST_LIMIT = 500;

export interface FirebasePushMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface FirebaseMulticastMessage {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface FirebaseTokenFailure {
  token: string;
  error: unknown;
}

@Injectable()
export class FirebaseService {
  private readonly app?: App;

  constructor(config: ConfigService<Config>) {
    const firebase = config.get<Config['firebase']>('firebase');

    if (firebase?.projectId && firebase.clientEmail && firebase.privateKey) {
      this.app =
        getApps().find((app) => app.name === firebase.projectId) ??
        initializeApp(
          {
            credential: cert({
              projectId: firebase.projectId,
              clientEmail: firebase.clientEmail,
              privateKey: firebase.privateKey.replace(/\\n/g, '\n'),
            }),
          },
          firebase.projectId,
        );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.app);
  }

  async send(message: FirebasePushMessage): Promise<void> {
    if (!this.app) return;

    await getMessaging(this.app).send({
      token: message.token,
      notification: {
        title: message.title,
        body: message.body,
      },
      data: message.data,
    });
  }

  async sendMulticast(
    message: FirebaseMulticastMessage,
  ): Promise<FirebaseTokenFailure[]> {
    if (!this.app || message.tokens.length === 0) return [];

    const batches = await Promise.all(
      this.chunks(message.tokens, FCM_MULTICAST_LIMIT).map((tokens) =>
        getMessaging(this.app).sendEachForMulticast({
          tokens,
          notification: {
            title: message.title,
            body: message.body,
          },
          data: message.data,
        }),
      ),
    );

    return batches.flatMap((batch, batchIndex) =>
      this.failuresForBatch(
        this.chunks(message.tokens, FCM_MULTICAST_LIMIT)[batchIndex],
        batch,
      ),
    );
  }

  isPermanentTokenError(error: unknown): boolean {
    const code = this.errorCode(error);
    return (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/invalid-argument'
    );
  }

  private errorCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const nested = error as { code?: string };
    return nested.code;
  }

  private chunks<T>(items: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
      items.slice(index * size, index * size + size),
    );
  }

  private failuresForBatch(
    tokens: string[],
    batch: BatchResponse,
  ): FirebaseTokenFailure[] {
    return batch.responses.flatMap((response, index) =>
      response.success || !response.error
        ? []
        : [{ token: tokens[index], error: response.error }],
    );
  }
}
