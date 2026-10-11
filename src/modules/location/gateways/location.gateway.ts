import {
  Injectable,
  Logger,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { ACCESS_TOKEN_COOKIE } from '@/core/auth/auth.constants';
import { JwtStrategy } from '@/core/auth/strategies/jwt.strategy';
import type { JwtPayload } from '@/core/auth/types/jwt-payload.type';
import locals from '@/locals';
import {
  DashboardSubscribeDto,
  LocationPingDto,
} from '@/modules/location/dto/location.dto';
import { LocationRepository } from '@/modules/location/repositories/location.repository';
import { LocationIngestionService } from '@/modules/location/services/location-ingestion.service';
import {
  MAP_ADMIN_LOCATIONS_ROOM,
  LocationFanoutService,
} from '@/modules/location/services/location-fanout.service';
import { MapLocationService } from '@/modules/location/services/map-location.service';
import { MapVisibilityService } from '@/modules/location/services/map-visibility.service';
import type { LocationSocketData } from '@/modules/location/types/location.types';
import { OrganizationAccessService } from '@/modules/memberships/services/organization-access.service';

@Injectable()
@WebSocketGateway({ namespace: 'location', cors: true })
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class LocationGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(LocationGateway.name);

  @WebSocketServer() server!: Namespace;
  constructor(
    private readonly jwt: JwtService,
    private readonly jwtStrategy: JwtStrategy,
    private readonly locations: LocationRepository,
    private readonly ingestion: LocationIngestionService,
    private readonly fanout: LocationFanoutService,
    private readonly locationsMap: MapLocationService,
    private readonly visibility: MapVisibilityService,
    private readonly access: OrganizationAccessService,
  ) {}
  afterInit() {
    this.fanout.attach(this.server);
    this.server.use((socket, next) => {
      void this.authenticate(socket).then(() => {
        this.logConnection(socket);
        next();
      }, next);
    });
  }

  handleDisconnect(socket: Socket) {
    const data = socket.data as LocationSocketData;
    this.logger.log({
      event: 'socket.disconnected',
      namespace: 'location',
      socketId: socket.id,
      userId: data.user?.sub,
      driverId: data.driverId,
    });
  }

  @SubscribeMessage('location:ping') async ping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: LocationPingDto,
  ) {
    const data = socket.data as LocationSocketData;
    if (!data.driverId)
      throw new WsException(locals.location.driver_access_required);
    return this.ingestion.ingest(data.driverId, dto);
  }
  @SubscribeMessage('dashboard:subscribe') async subscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: DashboardSubscribeDto,
  ) {
    const data = socket.data as LocationSocketData;
    if (!data.user || data.driverId)
      throw new WsException(locals.memberships.organization_access_denied);
    await this.access.assertCanManage(data.user.sub, dto.organizationId);
    await socket.join([
      `org:${dto.organizationId}:locations`,
      `org:${dto.organizationId}:sos`,
    ]);
    if (!data.dashboardSubscriberUserId) {
      data.dashboardSubscriberUserId = data.user.sub;
      this.fanout.subscribeDashboard(data.user.sub);
      socket.once('disconnect', () => {
        this.fanout.unsubscribeDashboard(data.user!.sub);
      });
    }
    return { subscribed: true };
  }

  @SubscribeMessage('map:subscribe') async subscribeMap(
    @ConnectedSocket() socket: Socket,
  ) {
    const data = socket.data as LocationSocketData;
    if (!data.user) throw new WsException(locals.auth.access_token_required);

    const [{ organizationIds }, focus] = await Promise.all([
      this.visibility.resolve(data.user),
      this.locationsMap.overview(data.user),
    ]);
    if (organizationIds === null) {
      await socket.join(MAP_ADMIN_LOCATIONS_ROOM);
      socket.emit('map:focus', focus);
      return { subscribed: true, scope: 'admin', focus };
    }

    await socket.join(organizationIds.map((id) => `org:${id}:locations`));
    socket.emit('map:focus', focus);
    return {
      subscribed: true,
      scope: 'organizations',
      organizationIds,
      focus,
    };
  }

  private async authenticate(socket: Socket): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(
        this.token(socket),
      );
      const user = await this.jwtStrategy.validate(payload);
      const driver = await this.locations.findDriverByUser(user.sub);
      const data = socket.data as LocationSocketData;
      data.user = user;
      if (driver) data.driverId = driver.id;
    } catch {
      throw new Error(locals.auth.access_token_required);
    }
  }

  private logConnection(socket: Socket) {
    const data = socket.data as LocationSocketData;
    this.logger.log({
      event: 'socket.connected',
      namespace: 'location',
      socketId: socket.id,
      userId: data.user?.sub,
      driverId: data.driverId,
    });
  }

  private token(socket: Socket) {
    const handshakeAuth = socket.handshake.auth as Record<string, unknown>;
    const auth = handshakeAuth.token;
    const header = socket.handshake.headers.authorization;
    const cookie = socket.handshake.headers.cookie;
    const token =
      typeof auth === 'string'
        ? auth
        : typeof header === 'string'
          ? header.replace(/^Bearer\s+/i, '')
          : typeof cookie === 'string'
            ? this.cookie(cookie, ACCESS_TOKEN_COOKIE)
            : '';
    if (!token) throw new UnauthorizedException();
    return token;
  }

  private cookie(header: string, name: string) {
    const prefix = `${name}=`;
    return (
      header
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(prefix))
        ?.slice(prefix.length) ?? ''
    );
  }
}
