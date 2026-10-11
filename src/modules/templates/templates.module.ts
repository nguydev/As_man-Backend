import { Module } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { EmailDispatchRepository } from '@/modules/templates/repositories/email-dispatch.repository';
import { TemplateRepository } from '@/modules/templates/repositories/template.repository';
import { TemplateSendService } from '@/modules/templates/services/template-send.service';
import { TemplateService } from '@/modules/templates/services/template.service';
import { TemplatesController } from '@/modules/templates/templates.controller';

@Module({
  imports: [AuthModule],
  controllers: [TemplatesController],
  providers: [
    TemplateRepository,
    EmailDispatchRepository,
    TemplateService,
    TemplateSendService,
  ],
  exports: [TemplateService, TemplateSendService],
})
export class TemplatesModule {}
