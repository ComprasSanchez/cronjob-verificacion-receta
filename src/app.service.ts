import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlexService } from './plex/plex.service';
import { IRecetaAuditado } from './auditoria/interface/receta-auditada.interface';
import { RecetaPlex } from './plex/plex.interface';
import { AuditoriaService } from './auditoria/auditoria.service';

@Injectable()
export class AppService implements OnModuleInit {
    private readonly logger = new Logger(AppService.name);

    constructor(
        private readonly auditoriaService: AuditoriaService,
        private readonly plexService: PlexService,
    ) { }

    async onModuleInit() {
        this.logger.debug('🚀 Ejecutando validación inicial al iniciar la app..., si no esta comentada xd');
        await this.validarRecetas(); // 👈 se ejecuta apenas se levanta
    }

    @Cron(CronExpression.EVERY_6_HOURS)
    async validarRecetas() {
        // Fecha actual
        const hoy = new Date();
        const fecha = hoy.toLocaleDateString('es-AR');
        const hora = hoy.toLocaleTimeString('es-AR', { hour12: false });

        // Ayer (inicio del día)
        const ayer = new Date(hoy);
        ayer.setDate(hoy.getDate() - 3);
        ayer.setHours(0, 0, 0, 0);

        // Mañana (fin del día)
        const manana = new Date(hoy);
        manana.setDate(hoy.getDate() + 1);
        manana.setHours(23, 59, 59, 999);

        // Formato MySQL: YYYY-MM-DD
        const fechaDesde = ayer.toISOString().split('T')[0];
        const fechaHasta = manana.toISOString().split('T')[0];
        this.logger.debug(
            `⏰ El cronjob de validación de recetas se ejecutó el día de hoy (${fecha} a las ${hora}).`,
        );
        try {
            this.logger.debug(
                `⏰ Ejecutando validación automática de recetas... Rango: ${fechaDesde} -> ${fechaHasta}`,
            );

            // Traer recetas de Plex en el rango
            const recetasPlex = await this.plexService.getRecetasPlex(fechaDesde, fechaHasta);

            const resultados: IRecetaAuditado[] = [];

            for (const recetaPlex of recetasPlex ?? []) {
                try {
                    const match = this.matchPlex(recetaPlex);
                    resultados.push(match);
                } catch (e) {
                    this.logger.error(
                        `❌ Error procesando receta (Suc:${recetaPlex?.Sucursal}, CodAut:${recetaPlex?.CodAutorizacion}, IdReceta:${recetaPlex?.IDReceta})`,
                        e instanceof Error ? e.stack : String(e),
                    );
                }
            }

            this.logger.debug(`✅ Validación finalizada. Total procesadas: ${resultados.length}`);
            const resultadosGuardados = await this.auditoriaService.bulkRecetaAudita(resultados);
            this.logger.debug('Proceso finalizado totales', resultadosGuardados);
            return;
        } catch (err) {
            this.logger.error(
                '❌ Error general en validarRecetas',
                err instanceof Error ? err.stack : String(err),
            );
            throw err;
        }
    }

    matchPlex(recetaPlex: RecetaPlex): IRecetaAuditado {
        return {
            idComprobante: recetaPlex.IDComprobante,
            comprobante: recetaPlex.Comprobante.toString(),
            idReceta: recetaPlex.IDReceta,
            idRecetaGlobal: recetaPlex.IdRecetaGlobal ?? null,
            numeroReceta: recetaPlex.NumReceta ?? null,
            idCaja: recetaPlex.idGlobal, // await this.auditoriaService.getCajaSegunGlobal(recetaPlex.idGlobal),
            fechaAperturaCaja: recetaPlex.FechaApertura,
            fechaCierreCaja: recetaPlex.FechaCierre,
            sucursal: recetaPlex.Sucursal,
            idObSocPlex: recetaPlex.CodObSoc,
            descripcionSucursal: recetaPlex.Descripcio,
            fechaEmision: recetaPlex.FechaEmision,
            fechaPrescipcion: recetaPlex.FechaPrescripcion,
            fechaDispensacion: recetaPlex.FechaDispensacion,
            codAutorizacion: recetaPlex.CodAutorizacion,
            totalReceta: recetaPlex.TotReceta,
            totalACOS: recetaPlex.TotACOS,
            operador: recetaPlex.Operador,
            auditada: false,
            irregular: false,
            estado: null,
        };
    }
}
