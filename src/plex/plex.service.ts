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
        cajapartes.idGlobal,
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
        operadores.Operador
      FROM reccabecera
      LEFT JOIN factcabecera ON reccabecera.IDComprobante = factcabecera.IDComprobante
      LEFT JOIN obsociales ON reccabecera.IDObSoc = obsociales.CodObSoc 
      LEFT JOIN operadores ON reccabecera.IDUsuario = operadores.IDOperador
      LEFT JOIN cajapartes ON factcabecera.IDCajaParte = cajapartes.IDCajaParte
      WHERE reccabecera.FechaEmision BETWEEN ? AND ? AND reccabecera.CodAutorizacion IS NOT NULL;
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
}
