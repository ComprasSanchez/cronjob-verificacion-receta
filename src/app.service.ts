import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlexService } from './plex/plex.service';
import { IRecetaAuditado } from './auditoria/interface/receta-auditada.interface';
import { RecetaPlex } from './plex/plex.interface';
import { AuditoriaService } from './auditoria/auditoria.service';

@Injectable()
export class AppService implements OnModuleInit {
    private readonly logger = new Logger(AppService.name);
    private static readonly RECONCILIACION_DIAS = 90;
    private static readonly RECONCILIACION_BLOQUE_DIAS = 7;

    constructor(
        private readonly auditoriaService: AuditoriaService,
        private readonly plexService: PlexService,
    ) {}

    async onModuleInit() {
        this.logger.debug(
            '🚀 Ejecutando validación inicial al iniciar la app..., si no esta comentada xd',
        );
        await this.validarRecetas(); // 👈 se ejecuta apenas se levanta
        await this.backfillNumeroReceta(); // 👈 completa numero_receta de los registros viejos
        await this.backfillIdGlobal(); // 👈 completa id_global de los registros viejos
        await this.backfillRefIdGlobal(); // 👈 completa ref_id_global de los registros viejos
        await this.reconciliarUltimos90Dias(); // 👈 reintenta los ultimos 90 dias al iniciar
    }

    @Cron('0 5 * * *')
    async reconciliarUltimos90Dias() {
        this.logger.debug('🕔 Iniciando reconciliacion diaria de 90 dias...');

        const hoy = new Date();
        const inicio = new Date(hoy);
        inicio.setDate(hoy.getDate() - AppService.RECONCILIACION_DIAS);
        inicio.setHours(0, 0, 0, 0);

        const fin = new Date(hoy);
        fin.setHours(23, 59, 59, 999);

        let bloqueInicio = new Date(inicio);
        while (bloqueInicio <= fin) {
            const bloqueFin = new Date(bloqueInicio);
            bloqueFin.setDate(bloqueInicio.getDate() + AppService.RECONCILIACION_BLOQUE_DIAS - 1);
            if (bloqueFin > fin) {
                bloqueFin.setTime(fin.getTime());
            }

            const fechaDesde = this.formatDateOnly(bloqueInicio);
            const fechaHasta = this.formatDateOnly(bloqueFin);
            this.logger.debug(`🧩 Reconciliando bloque: ${fechaDesde} -> ${fechaHasta}`);

            await this.validarRecetasEnRango(fechaDesde, fechaHasta, 'reconciliacion diaria');
            await this.backfillNumeroRecetaEnRango(fechaDesde, fechaHasta);
            await this.backfillIdGlobalEnRango(fechaDesde, fechaHasta);
            await this.backfillRefIdGlobalEnRango(fechaDesde, fechaHasta);

            bloqueInicio = new Date(bloqueFin);
            bloqueInicio.setDate(bloqueInicio.getDate() + 1);
            bloqueInicio.setHours(0, 0, 0, 0);
        }

        this.logger.debug('🏁 Reconciliacion diaria de 90 dias finalizada.');
    }

    /**
     * Backfill al arranque: completa numero_receta SOLO en las recetas que lo tienen en NULL,
     * tomando el valor desde Plex (NumReceta) por IDReceta.
     */
    async backfillNumeroReceta() {
        try {
            const idRecetas = await this.auditoriaService.getIdRecetasSinNumero();
            await this.ejecutarBackfillNumeroReceta(idRecetas, 'Backfill');
        } catch (err) {
            this.logger.error(
                '❌ Error en backfill de numero_receta',
                err instanceof Error ? err.stack : String(err),
            );
        }
    }

    /**
     * Backfill al arranque: completa id_global SOLO si está en NULL,
     * tomando el valor desde Plex por IDReceta.
     */
    async backfillIdGlobal() {
        try {
            const idRecetas = await this.auditoriaService.getIdRecetasSinIdGlobal();
            await this.ejecutarBackfillIdGlobal(idRecetas, 'Backfill');
        } catch (err) {
            this.logger.error(
                '❌ Error en backfill de id_global',
                err instanceof Error ? err.stack : String(err),
            );
        }
    }

    /**
     * Backfill al arranque: completa ref_id_global SOLO si está en NULL,
     * tomando el valor resuelto desde factlineas por IDReceta.
     */
    async backfillRefIdGlobal() {
        try {
            const idRecetas = await this.auditoriaService.getIdRecetasSinRefIdGlobal();
            await this.ejecutarBackfillRefIdGlobal(idRecetas, 'Backfill');
        } catch (err) {
            this.logger.error(
                '❌ Error en backfill de ref_id_global',
                err instanceof Error ? err.stack : String(err),
            );
        }
    }

    @Cron(CronExpression.EVERY_6_HOURS)
    async validarRecetas() {
        const hoy = new Date();
        const ayer = new Date(hoy);
        ayer.setDate(hoy.getDate() - 3);
        ayer.setHours(0, 0, 0, 0);
        const manana = new Date(hoy);
        manana.setDate(hoy.getDate() + 1);
        manana.setHours(23, 59, 59, 999);
        const fechaDesde = this.formatDateOnly(ayer);
        const fechaHasta = this.formatDateOnly(manana);
        await this.validarRecetasEnRango(fechaDesde, fechaHasta, 'validacion automatica');
    }

    async backfillNumeroRecetaEnRango(fechaDesde: string, fechaHasta: string) {
        try {
            const idRecetas = await this.auditoriaService.getIdRecetasSinNumeroEnRango(
                fechaDesde,
                fechaHasta,
            );
            await this.ejecutarBackfillNumeroReceta(
                idRecetas,
                `Reconciliacion numero_receta ${fechaDesde} -> ${fechaHasta}`,
            );
        } catch (err) {
            this.logger.error(
                `❌ Error en backfill de numero_receta para rango ${fechaDesde} -> ${fechaHasta}`,
                err instanceof Error ? err.stack : String(err),
            );
        }
    }

    async backfillIdGlobalEnRango(fechaDesde: string, fechaHasta: string) {
        try {
            const idRecetas = await this.auditoriaService.getIdRecetasSinIdGlobalEnRango(
                fechaDesde,
                fechaHasta,
            );
            await this.ejecutarBackfillIdGlobal(
                idRecetas,
                `Reconciliacion id_global ${fechaDesde} -> ${fechaHasta}`,
            );
        } catch (err) {
            this.logger.error(
                `❌ Error en backfill de id_global para rango ${fechaDesde} -> ${fechaHasta}`,
                err instanceof Error ? err.stack : String(err),
            );
        }
    }

    async backfillRefIdGlobalEnRango(fechaDesde: string, fechaHasta: string) {
        try {
            const idRecetas = await this.auditoriaService.getIdRecetasSinRefIdGlobalEnRango(
                fechaDesde,
                fechaHasta,
            );
            await this.ejecutarBackfillRefIdGlobal(
                idRecetas,
                `Reconciliacion ref_id_global ${fechaDesde} -> ${fechaHasta}`,
            );
        } catch (err) {
            this.logger.error(
                `❌ Error en backfill de ref_id_global para rango ${fechaDesde} -> ${fechaHasta}`,
                err instanceof Error ? err.stack : String(err),
            );
        }
    }

    async validarRecetasEnRango(fechaDesde: string, fechaHasta: string, contexto: string) {
        const hoy = new Date();
        const fecha = hoy.toLocaleDateString('es-AR');
        const hora = hoy.toLocaleTimeString('es-AR', { hour12: false });

        this.logger.debug(
            `⏰ El proceso de ${contexto} se ejecutó el día de hoy (${fecha} a las ${hora}).`,
        );
        try {
            this.logger.debug(`⏰ Ejecutando ${contexto}... Rango: ${fechaDesde} -> ${fechaHasta}`);

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

            this.logger.debug(`✅ ${contexto} finalizada. Total procesadas: ${resultados.length}`);
            const resultadosGuardados = await this.auditoriaService.bulkRecetaAudita(resultados);
            this.logger.debug(`Proceso finalizado totales (${contexto})`, resultadosGuardados);
        } catch (err) {
            this.logger.error(
                `❌ Error general en ${contexto}`,
                err instanceof Error ? err.stack : String(err),
            );
            throw err;
        }
    }

    private async ejecutarBackfillNumeroReceta(idRecetas: number[], contexto: string) {
        this.logger.debug(`🔎 ${contexto}: ${idRecetas.length} recetas sin numero_receta`);

        if (idRecetas.length === 0) {
            this.logger.debug(`✅ ${contexto}: no hay numero_receta para completar.`);
            return;
        }

        const filasPlex = await this.plexService.getNumRecetasByIds(idRecetas);
        const valores = filasPlex.map((f) => ({
            idReceta: f.IDReceta,
            numeroReceta: f.NumReceta ?? null,
        }));

        const resultado = await this.auditoriaService.backfillNumeroReceta(valores);
        this.logger.debug(
            `🏁 ${contexto}: numero_receta finalizado → Candidatas: ${resultado.total} | Actualizadas: ${resultado.actualizadas}`,
        );
    }

    private async ejecutarBackfillIdGlobal(idRecetas: number[], contexto: string) {
        this.logger.debug(`🔎 ${contexto}: ${idRecetas.length} recetas sin id_global`);

        if (idRecetas.length === 0) {
            this.logger.debug(`✅ ${contexto}: no hay id_global para completar.`);
            return;
        }

        const filasPlex = await this.plexService.getIdGlobalByIds(idRecetas);
        const valores = filasPlex.map((f) => ({
            idReceta: f.IDReceta,
            idGlobal: f.IDGlobal ?? null,
        }));

        const sinMatch = idRecetas.length - valores.length;
        if (sinMatch > 0) {
            this.logger.warn(`⚠️ ${contexto}: ${sinMatch} recetas no devolvieron idGlobal en Plex`);
        }

        const resultado = await this.auditoriaService.backfillIdGlobal(valores);
        this.logger.debug(
            `🏁 ${contexto}: id_global finalizado → Candidatas: ${resultado.total} | Actualizadas: ${resultado.actualizadas}`,
        );
    }

    private async ejecutarBackfillRefIdGlobal(idRecetas: number[], contexto: string) {
        this.logger.debug(`🔎 ${contexto}: ${idRecetas.length} recetas sin ref_id_global`);

        if (idRecetas.length === 0) {
            this.logger.debug(`✅ ${contexto}: no hay ref_id_global para completar.`);
            return;
        }

        const filasPlex = await this.plexService.getRefIdGlobalByIds(idRecetas);
        const valores = filasPlex.map((f) => ({
            idReceta: f.IDReceta,
            refIdGlobal: f.RefIDGlobal ?? null,
        }));

        const sinMatch = idRecetas.length - valores.length;
        if (sinMatch > 0) {
            this.logger.warn(
                `⚠️ ${contexto}: ${sinMatch} recetas no devolvieron RefIDGlobal en Plex`,
            );
        }

        const resultado = await this.auditoriaService.backfillRefIdGlobal(valores);
        this.logger.debug(
            `🏁 ${contexto}: ref_id_global finalizado → Candidatas: ${resultado.total} | Actualizadas: ${resultado.actualizadas}`,
        );
    }

    private formatDateOnly(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    matchPlex(recetaPlex: RecetaPlex): IRecetaAuditado {
        return {
            idComprobante: recetaPlex.IDComprobante,
            comprobante: recetaPlex.Comprobante.toString(),
            idReceta: recetaPlex.IDReceta,
            idRecetaGlobal: recetaPlex.IdRecetaGlobal ?? null,
            numeroReceta: recetaPlex.NumReceta ?? null,
            idGlobal: recetaPlex.IDGlobal ?? null,
            refIdGlobal: recetaPlex.RefIDGlobal ?? null,
            idCaja: recetaPlex.IDGlobal ?? null, // await this.auditoriaService.getCajaSegunGlobal(recetaPlex.IDGlobal),
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
