import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RecetaPlex } from './plex.interface';

@Injectable()
export class PlexService {
    private readonly logger = new Logger(PlexService.name);

    constructor(
        @InjectDataSource('mysql-plex')
        private dataSource: DataSource,
    ) {}

    async getRecetasPlex(fechaDesde: string, fechaHasta: string): Promise<RecetaPlex[]> {
        const sql = `
      SELECT 
        factcabecera.IDComprobante,
        reccabecera.IDReceta,
        reccabecera.IdRecetaGlobal,
        cajapartes.idGlobal,
        factlineas_ref.RefIDGlobal,
        cajapartes.FechaApertura,
        cajapartes.FechaCierre,
        reccabecera.Sucursal,
        reccabecera.NumReceta,
        obsociales.CodObSoc,
        obsociales.Descripcio,
        reccabecera.AfilNumero,
        reccabecera.AfilNombre,
        reccabecera.FechaEmision,
        reccabecera.FechaPrescripcion,
        reccabecera.FechaDispensacion,
        reccabecera.FechaAutorizacion,
        reccabecera.CodAutorizacion,
        reccabecera.MedMatricula,
        reccabecera.MedNombre,
        reccabecera.TotReceta,
        reccabecera.TotACOS,
        reccabecera.Presentada,
        reccabecera.Pendiente,
        CONCAT(reccabecera.Tipo, '-', reccabecera.Letra, '-', reccabecera.PuntoVta, '-', reccabecera.Numero) AS Comprobante,
        operadores.Operador,
        factcabecera.Tipo
      FROM reccabecera
      LEFT JOIN factcabecera ON reccabecera.IDComprobante = factcabecera.IDComprobante
      LEFT JOIN (
        SELECT
          factlineas.IDComprobante,
          CASE
            WHEN COUNT(*) = COUNT(factlineas.RefIDGlobal)
             AND COUNT(DISTINCT factlineas.RefIDGlobal) = 1 THEN MIN(factlineas.RefIDGlobal)
            ELSE NULL
          END AS RefIDGlobal
        FROM factlineas
        GROUP BY factlineas.IDComprobante
      ) factlineas_ref ON factcabecera.IDComprobante = factlineas_ref.IDComprobante
      LEFT JOIN obsociales ON reccabecera.IDObSoc = obsociales.CodObSoc 
      LEFT JOIN operadores ON reccabecera.IDUsuario = operadores.IDOperador
      LEFT JOIN cajapartes ON factcabecera.IDCajaParte = cajapartes.IDCajaParte
      WHERE reccabecera.FechaDispensacion BETWEEN ? AND ?;
    `;

        try {
            const recetas = await this.dataSource.query<RecetaPlex[]>(sql, [
                fechaDesde,
                fechaHasta,
            ]);
            this.logger.debug(
                `✅ ${recetas.length} recetas encontradas entre ${fechaDesde} y ${fechaHasta}`,
            );
            return recetas;
        } catch (error) {
            this.logger.error('❌ Error al obtener recetas Plex:', error);
            throw error;
        }
    }

    /**
     * Devuelve el NumReceta de Plex para una lista de IDReceta.
     * Consulta en lotes para no exceder el límite de parámetros del driver.
     */
    async getNumRecetasByIds(
        idRecetas: number[],
        chunkSize = 10000,
    ): Promise<{ IDReceta: number; NumReceta: string | null }[]> {
        const resultados: { IDReceta: number; NumReceta: string | null }[] = [];

        for (let i = 0; i < idRecetas.length; i += chunkSize) {
            const chunk = idRecetas.slice(i, i + chunkSize);
            const placeholders = chunk.map(() => '?').join(', ');
            const sql = `
        SELECT IDReceta, NumReceta
        FROM reccabecera
        WHERE IDReceta IN (${placeholders});
      `;
            const filas = await this.dataSource.query<
                { IDReceta: number; NumReceta: string | null }[]
            >(sql, chunk);
            resultados.push(...filas);
        }

        const conValor = resultados.filter(
            (r) => r.NumReceta !== null && r.NumReceta !== undefined && `${r.NumReceta}` !== '',
        ).length;
        this.logger.debug(
            `✅ Plex devolvió ${resultados.length}/${idRecetas.length} IDReceta | con NumReceta no nulo: ${conValor}`,
        );
        return resultados;
    }

    /**
     * Devuelve el idGlobal de la caja de Plex para una lista de IDReceta.
     */
    async getIdGlobalByIds(
        idRecetas: number[],
        chunkSize = 10000,
    ): Promise<{ IDReceta: number; idGlobal: number | null }[]> {
        const resultados: { IDReceta: number; idGlobal: number | null }[] = [];

        for (let i = 0; i < idRecetas.length; i += chunkSize) {
            const chunk = idRecetas.slice(i, i + chunkSize);
            const placeholders = chunk.map(() => '?').join(', ');
            const sql = `
        SELECT reccabecera.IDReceta, cajapartes.idGlobal
        FROM reccabecera
        LEFT JOIN factcabecera ON reccabecera.IDComprobante = factcabecera.IDComprobante
        LEFT JOIN cajapartes ON factcabecera.IDCajaParte = cajapartes.IDCajaParte
        WHERE reccabecera.IDReceta IN (${placeholders})
      `;
            const filas = await this.dataSource.query<
                { IDReceta: number; idGlobal: number | null }[]
            >(sql, chunk);
            resultados.push(...filas);
        }

        const conValor = resultados.filter(
            (r) => r.idGlobal !== null && r.idGlobal !== undefined,
        ).length;
        this.logger.debug(
            `✅ Plex devolvió ${resultados.length}/${idRecetas.length} IDReceta | con idGlobal no nulo: ${conValor}`,
        );
        return resultados;
    }

    /**
     * Devuelve el RefIDGlobal resuelto desde factlineas para una lista de IDReceta.
     * Solo se informa cuando todas las lineas del comprobante coinciden en el mismo RefIDGlobal.
     */
    async getRefIdGlobalByIds(
        idRecetas: number[],
        chunkSize = 10000,
    ): Promise<{ IDReceta: number; RefIDGlobal: number | null }[]> {
        const resultados: { IDReceta: number; RefIDGlobal: number | null }[] = [];

        for (let i = 0; i < idRecetas.length; i += chunkSize) {
            const chunk = idRecetas.slice(i, i + chunkSize);
            const placeholders = chunk.map(() => '?').join(', ');
            const sql = `
        SELECT
          reccabecera.IDReceta,
          factlineas_ref.RefIDGlobal
        FROM reccabecera
        LEFT JOIN factcabecera ON reccabecera.IDComprobante = factcabecera.IDComprobante
        LEFT JOIN (
          SELECT
            factlineas.IDComprobante,
            CASE
              WHEN COUNT(*) = COUNT(factlineas.RefIDGlobal)
               AND COUNT(DISTINCT factlineas.RefIDGlobal) = 1 THEN MIN(factlineas.RefIDGlobal)
              ELSE NULL
            END AS RefIDGlobal
          FROM factlineas
          GROUP BY factlineas.IDComprobante
        ) factlineas_ref ON factcabecera.IDComprobante = factlineas_ref.IDComprobante
        WHERE reccabecera.IDReceta IN (${placeholders});
      `;
            const filas = await this.dataSource.query<
                { IDReceta: number; RefIDGlobal: number | null }[]
            >(sql, chunk);
            resultados.push(...filas);
        }

        const conValor = resultados.filter(
            (r) => r.RefIDGlobal !== null && r.RefIDGlobal !== undefined,
        ).length;
        this.logger.debug(
            `✅ Plex devolvió ${resultados.length}/${idRecetas.length} IDReceta | con RefIDGlobal no nulo: ${conValor}`,
        );
        return resultados;
    }
}
