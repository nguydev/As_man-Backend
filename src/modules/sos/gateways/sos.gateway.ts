import { Injectable, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import {
  AuthPermission,
  PermissionLevel,
} from '@/core/auth/auth-permissions.constants';
import { hasPermission } from '@/core/auth/helpers/permission.helper';
import locals from '@/locals';
import { ADMIN_SOS_ROOM } from '@/modules/location/services/location-fanout.service';
import type { LocationSocketData } from '@/modules/location/types/location.types';
import { TriggerSosDto } from '@/modules/sos/dto/sos.dto';
import { SosService } from '@/modules/sos/services/sos.service';

@Injectable()
@WebSocketGateway({ namespace: 'location', cors: true })
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class SosGateway {
  constructor(private readonly sos: SosService) {}

  @SubscribeMessage('sos:trigger')
  trigger(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: TriggerSosDto,
  ) {
    const data = socket.data as LocationSocketData;
    if (!data.user || !data.driverId)
      throw new WsException(locals.location.driver_access_required);
    return this.sos.trigger(data.user.sub, dto);
  }

  @SubscribeMessage('admin:sos:subscribe')
  async subscribeAdmin(@ConnectedSocket() socket: Socket) {
    const data = socket.data as LocationSocketData;
    if (data.adminSosSubscriber) return { subscribed: true };

    const user = data.user;
    const canReadSos =
      user?.authorization.role === 'ADMIN' ||
      hasPermission(
        user?.authorization.permissions ?? null,
        AuthPermission.SYSTEM_SOS,
        PermissionLevel.READ,
      );

    if (!canReadSos) throw new WsException(locals.auth.permission_denied);

    await socket.join(ADMIN_SOS_ROOM);
    data.adminSosSubscriber = true;
    return { subscribed: true };
  }
}
