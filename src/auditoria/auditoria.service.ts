import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RecetaAuditado } from './entities/recetas.entity';
import { Repository } from 'typeorm';
import { IRecetaAuditado } from './interface/receta-auditada.interface';
import { CajaAuditada } from './entities/caja-auditada.entity';

@Injectable()
export class AuditoriaService {
    private readonly logger = new Logger(AuditoriaService.name);

    constructor(
        @InjectRepository(RecetaAuditado, 'postgresConnection')
        private readonly recetaAuditaRepository: Repository<RecetaAuditado>,

        @InjectRepository(CajaAuditada, 'postgresConnection')
        private readonly cajaAuditaba: Repository<CajaAuditada>,
    ) {}

    async bulkRecetaAudita(recetas: IRecetaAuditado[]) {
        if (!recetas?.length) {
            this.logger.warn('⚠️ No se recibieron recetas para auditar.');
            return { total: 0, insertadas: 0, actualizadas: 0, fallidas: 0 };
        }

        this.logger.log(`📦 Iniciando UPSERT individual de ${recetas.length} recetas auditadas...`);

        let insertadas = 0;
        let actualizadas = 0;
        let fallidas = 0;

        for (const receta of recetas) {
            try {
                // Ejecutar upsert individual (por idReceta)
                const result = await this.recetaAuditaRepository.upsert(receta, ['idReceta']);

                // `result.generatedMaps` indica si fue insert
                if (result.generatedMaps.length > 0) {
                    insertadas++;
                } else {
                    actualizadas++;
                }
            } catch (error) {
                fallidas++;
                this.logger.error(
                    `❌ Error en UPSERT de receta (IDReceta: ${receta.idReceta}, IDComprobante: ${receta.idComprobante})`,
                    error instanceof Error ? error.message : String(error),
                );
            }
        }

        const total = recetas.length;
        this.logger.log(
            `📊 UPSERT finalizado → Total: ${total} | 🆕 Insertadas: ${insertadas} | 🔁 Actualizadas: ${actualizadas} | ❌ Fallidas: ${fallidas}`,
        );

        return { total, insertadas, actualizadas, fallidas };
    }

    /**
     * Devuelve todos los idReceta de la tabla receta-auditado.
     */
    async getTodosLosIdRecetas(): Promise<number[]> {
        const filas = await this.recetaAuditaRepository.find({
            select: { idReceta: true },
        });
        return filas.map((f) => f.idReceta);
    }

    /**
     * Actualiza numero_receta en lotes a partir de un mapa idReceta -> NumReceta.
     * Pisa el valor en todas las filas que matcheen el idReceta.
     */
    async backfillNumeroReceta(
        valores: { idReceta: number; numeroReceta: string | null }[],
        chunkSize = 10000,
    ): Promise<{ total: number; actualizadas: number }> {
        let actualizadas = 0;

        for (let i = 0; i < valores.length; i += chunkSize) {
            const chunk = valores.slice(i, i + chunkSize);

            // Construye: UPDATE ... FROM (VALUES ($1,$2),($3,$4)...) AS v(id_receta, numero_receta)
            const params: (number | string | null)[] = [];
            const tuples = chunk
                .map((v, idx) => {
                    params.push(v.idReceta, v.numeroReceta);
                    return `($${idx * 2 + 1}, $${idx * 2 + 2})`;
                })
                .join(', ');

            const sql = `
        UPDATE "receta-auditado" AS r
        SET numero_receta = v.numero_receta
        FROM (VALUES ${tuples}) AS v(id_receta, numero_receta)
        WHERE r.id_receta = v.id_receta::int
        RETURNING r.id_receta;
      `;

            const result = await this.recetaAuditaRepository.query<{ id_receta: number }[]>(
                sql,
                params,
            );
            actualizadas += Array.isArray(result) ? result.length : 0;
            this.logger.debug(
                `🔁 Backfill lote ${i / chunkSize + 1}: ${chunk.length} filas procesadas`,
            );
        }

        this.logger.log(
            `📊 Backfill numero_receta → Total candidatas: ${valores.length} | Actualizadas: ${actualizadas}`,
        );
        return { total: valores.length, actualizadas };
    }

    async getCajaSegunGlobal(idGlobal: number): Promise<number> {
        const caja = await this.cajaAuditaba.findOne({ where: { idGlobal } });
        if (caja) {
            this.logger.debug(`Caja encontrada ${caja.id}`);
            return caja.id;
        }
        return idGlobal;
    }
}
