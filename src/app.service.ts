import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MisvalidacionesService } from './misvalidaciones/misvalidaciones.service';

@Injectable()
export class AppService {
    private readonly logger = new Logger(AppService.name);

    constructor(
        private readonly misvalidacionesService: MisvalidacionesService, // ✅ inyección de dependencia
    ) {}

    @Cron(CronExpression.EVERY_MINUTE)
    async validarRecetas() {
        this.logger.debug('⏰ Ejecutando validación automática de recetas...');
        await this.misvalidacionesService.getRecetas(1, '2527533210958');
        this.logger.debug('Finalizado');
    }
}
