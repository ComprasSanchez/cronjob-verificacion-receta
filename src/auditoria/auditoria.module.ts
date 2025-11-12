import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecetaAuditado } from './entities/recetas.entity';
import { AuditoriaService } from './auditoria.service';
import { CajaAuditada } from './entities/caja-auditada.entity';

@Module({
    imports: [TypeOrmModule.forFeature([RecetaAuditado, CajaAuditada], 'postgresConnection')],
    providers: [AuditoriaService],
    exports: [AuditoriaService],
})
export class AuditoriaModule {}
