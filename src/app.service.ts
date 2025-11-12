import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MisvalidacionesService } from './misvalidaciones/misvalidaciones.service';
import { PlexService } from './plex/plex.service';
import obrasocialApi from './constante/obrasocial-api';
import { IRecetaAuditado } from './auditoria/interface/receta-auditada.interface';
import { RecetaPlex } from './plex/plex.interface';
import { RecetaResponse } from './misvalidaciones/misvañidaciones.interface';
import { AuditoriaService } from './auditoria/auditoria.service';

@Injectable()
export class AppService implements OnModuleInit {
    private readonly logger = new Logger(AppService.name);

    constructor(
        private readonly auditoriaService: AuditoriaService,
        private readonly misvalidacionesService: MisvalidacionesService,
        private readonly plexService: PlexService,
    ) {}

    async onModuleInit() {
        this.logger.debug('🚀 Ejecutando validación inicial al iniciar la app...');
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
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const os = obrasocialApi[recetaPlex.CodObSoc];
                switch (os) {
                    case 'MISVALIDACIONES': {
                        try {
                            const recetaMis = await this.misvalidacionesService.getRecetas(
                                recetaPlex.Sucursal,
                                recetaPlex.CodAutorizacion || '0',
                            );

                            const match = await this.matchPlexWithMisValidaciones(
                                recetaPlex,
                                recetaMis,
                            );
                            resultados.push(match);
                        } catch (e) {
                            this.logger.error(
                                `❌ Error validando MISVALIDACIONES (Suc:${recetaPlex?.Sucursal}, CodAut:${recetaPlex?.CodAutorizacion})`,
                                e instanceof Error ? e.stack : String(e),
                            );
                        }
                        break;
                    }

                    case 'SINAPP': {
                        try {
                            const match = await this.matchPlexWithoutApp(recetaPlex);
                            resultados.push(match);
                        } catch (e) {
                            this.logger.error(
                                `❌ Error validando SINAPP (Suc:${recetaPlex?.Sucursal}, CodAut:${recetaPlex?.CodAutorizacion}, IdReceta:${recetaPlex.IDReceta})`,
                                e instanceof Error ? e.stack : String(e),
                            );
                        }
                        break;
                    }
                    default:
                        this.logger.debug(
                            `ℹ️ OS no manejada en switch: ${recetaPlex?.CodObSoc} (IDReceta: ${recetaPlex?.IDReceta})`,
                        );
                        try {
                            const match = await this.matchPlexWithoutApp(recetaPlex);
                            resultados.push(match);
                        } catch (e) {
                            this.logger.error(
                                `❌ Error validando que no hicieron match (Suc:${recetaPlex?.Sucursal}, CodAut:${recetaPlex?.CodAutorizacion}, IdReceta:${recetaPlex.IDReceta})`,
                                e instanceof Error ? e.stack : String(e),
                            );
                        }
                        break;
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

    async matchPlexWithMisValidaciones(
        recetaPlex: RecetaPlex,
        recetaMisValidaciones: RecetaResponse | undefined,
    ): Promise<IRecetaAuditado> {
        let auditada = false;
        let irregular = false;
        if (recetaMisValidaciones) {
            const { precio_total, importe_cobertura } = recetaMisValidaciones.items[0];
            if (
                recetaPlex.TotReceta.toString() === precio_total &&
                recetaPlex.TotACOS.toString() === importe_cobertura
            ) {
                auditada = true;
            }

            if (recetaPlex.Tipo === 'FV' && recetaPlex.IDComprobanteRef) {
                irregular = true;
            }
        }

        return {
            idComprobante: recetaPlex.IDComprobante,
            comprobante: recetaPlex.Comprobante.toString(),
            idReceta: recetaPlex.IDReceta,
            idCaja: await this.auditoriaService.getCajaSegunGlobal(recetaPlex.idGlobal),
            idObSocPlex: recetaPlex.CodObSoc,
            descripcionSucursal: recetaPlex.Descripcio,
            fechaEmision: recetaPlex.FechaEmision,
            fechaPrescipcion: recetaPlex.FechaPrescripcion,
            codAutorizacion: recetaPlex.CodAutorizacion,
            totalReceta: recetaPlex.TotReceta,
            totalACOS: recetaPlex.TotACOS,
            operador: recetaPlex.Operador,
            auditada,
            irregular,
        };
    }

    async matchPlexWithoutApp(recetaPlex: RecetaPlex): Promise<IRecetaAuditado> {
        return {
            idComprobante: recetaPlex.IDComprobante,
            comprobante: recetaPlex.Comprobante.toString(),
            idReceta: recetaPlex.IDReceta,
            idCaja: await this.auditoriaService.getCajaSegunGlobal(recetaPlex.idGlobal),
            idObSocPlex: recetaPlex.CodObSoc,
            descripcionSucursal: recetaPlex.Descripcio,
            fechaEmision: recetaPlex.FechaEmision,
            fechaPrescipcion: recetaPlex.FechaPrescripcion,
            codAutorizacion: recetaPlex.CodAutorizacion,
            totalReceta: recetaPlex.TotReceta,
            totalACOS: recetaPlex.TotACOS,
            operador: recetaPlex.Operador,
            auditada: false,
            irregular: false,
        };
    }
}
