import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Config } from '@/configs/environment.config';
import type {
  RemoteAttorneyPage,
  RemoteAttorneyRecord,
} from '@/modules/attorneys/types/attorney-import.types';

interface RemoteListResponse {
  success?: boolean;
  data?: {
    data?: RemoteAttorneyRecord[];
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

@Injectable()
export class AttorneyImportClientService {
  private readonly logger = new Logger(AttorneyImportClientService.name);

  constructor(private readonly config: ConfigService<Config>) {}

  async fetchFinalizedPage(page: number): Promise<RemoteAttorneyPage> {
    const settings = this.config.get('attorneyImport', { infer: true });
    if (!settings) {
      throw new Error('Attorney import config is missing');
    }

    const url = new URL('/api/attorneys/finalized', settings.baseUrl);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(settings.pageSize));
    url.searchParams.set('minCases', String(settings.minCases));

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      this.logger.error(
        `Remote attorney import failed: ${response.status} ${response.statusText}`,
      );
      throw new Error(
        `Attorney import remote request failed with status ${response.status}`,
      );
    }

    const body = (await response.json()) as RemoteListResponse;
    const payload = body.data;
    return {
      data: Array.isArray(payload?.data) ? payload.data : [],
      page: payload?.page ?? page,
      limit: payload?.limit ?? settings.pageSize,
      total: payload?.total ?? 0,
      totalPages: payload?.totalPages ?? 0,
    };
  }
}
