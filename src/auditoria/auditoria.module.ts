import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecetaAuditado } from './entities/recetas.entity';
import { AuditoriaService } from './auditoria.service';

@Module({
    imports: [TypeOrmModule.forFeature([RecetaAuditado], 'postgresConnection')],
    providers: [AuditoriaService],
    exports: [AuditoriaService],
})
export class AuditoriaModule {}
