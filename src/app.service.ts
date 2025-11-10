import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MisvalidacionesService } from './misvalidaciones/misvalidaciones.service';
import { PlexService } from './plex/plex.service';

@Injectable()
export class AppService implements OnModuleInit {
    private readonly logger = new Logger(AppService.name);

    constructor(
        private readonly misvalidacionesService: MisvalidacionesService,
        private readonly plexService: PlexService,
    ) {}

    async onModuleInit() {
        this.logger.debug('🚀 Ejecutando validación inicial al iniciar la app...');
        await this.validarRecetas(); // 👈 se ejecuta apenas se levanta
    }

    @Cron(CronExpression.EVERY_10_MINUTES)
    async validarRecetas() {
        // Fecha actual
        const hoy = new Date();

        // Ayer (inicio del día)
        const ayer = new Date(hoy);
        ayer.setDate(hoy.getDate() - 1);
        ayer.setHours(0, 0, 0, 0);

        // Mañana (fin del día)
        const manana = new Date(hoy);
        manana.setDate(hoy.getDate() + 1);
        manana.setHours(23, 59, 59, 999);

        // Formato MySQL: YYYY-MM-DD
        const fechaDesde = ayer.toISOString().split('T')[0];
        const fechaHasta = manana.toISOString().split('T')[0];
        this.logger.debug(
            `⏰ Ejecutando validación automática de recetas... Fecha Inferio:${fechaDesde} - Fecha Superior${fechaHasta} `,
        );
        await this.misvalidacionesService.getRecetas(1, '2527533210958');
        await this.plexService.getRecetasPlex(fechaDesde, fechaHasta);
        this.logger.debug('Finalizado');
    }
}
