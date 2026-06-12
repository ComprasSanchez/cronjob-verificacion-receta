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
    ) { }

    async getRecetasPlex(fechaDesde: string, fechaHasta: string): Promise<RecetaPlex[]> {
        const sql = `
      SELECT 
        factcabecera.IDComprobante,
        reccabecera.IDReceta,
        reccabecera.IdRecetaGlobal,
        cajapartes.idGlobal,
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
        factcabecera.Tipo,
        factcabecera.IDComprobanteRef
      FROM reccabecera
      LEFT JOIN factcabecera ON reccabecera.IDComprobante = factcabecera.IDComprobante
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
}
