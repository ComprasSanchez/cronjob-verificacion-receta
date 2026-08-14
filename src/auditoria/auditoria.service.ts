import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RecetaAuditado } from './entities/recetas.entity';
import { In, IsNull, Repository } from 'typeorm';
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

    async bulkRecetaAudita(recetas: IRecetaAuditado[], chunkSize = 500) {
        if (!recetas?.length) {
            this.logger.warn('⚠️ No se recibieron recetas para auditar.');
            return { total: 0, insertadas: 0, actualizadas: 0, fallidas: 0 };
        }

        this.logger.log(
            `📦 Iniciando UPSERT por lotes de ${recetas.length} recetas auditadas (chunk: ${chunkSize})...`,
        );

        const total = recetas.length;
        let insertadas = 0;
        let actualizadas = 0;
        let fallidas = 0;
        let procesadas = 0;

        for (let i = 0; i < recetas.length; i += chunkSize) {
            const chunk = recetas.slice(i, i + chunkSize);
            const ids = chunk.map((receta) => receta.idReceta);

            try {
                const existentes = await this.recetaAuditaRepository.find({
                    select: { idReceta: true },
                    where: { idReceta: In(ids) },
                });

                await this.recetaAuditaRepository.upsert(chunk, ['idReceta']);

                actualizadas += existentes.length;
                insertadas += chunk.length - existentes.length;
            } catch (error) {
                fallidas += chunk.length;
                this.logger.error(
                    `❌ Error en UPSERT de lote (${i + 1}-${i + chunk.length})`,
                    error instanceof Error ? error.message : String(error),
                );
            } finally {
                procesadas += chunk.length;
                if (procesadas === total || procesadas % Math.max(chunkSize, 1000) === 0) {
                    this.logger.log(
                        `⏳ Progreso UPSERT recetas: ${procesadas}/${total} | 🆕 ${insertadas} | 🔁 ${actualizadas} | ❌ ${fallidas}`,
                    );
                }
            }
        }

        this.logger.log(
            `📊 UPSERT finalizado → Total: ${total} | 🆕 Insertadas: ${insertadas} | 🔁 Actualizadas: ${actualizadas} | ❌ Fallidas: ${fallidas}`,
        );

        return { total, insertadas, actualizadas, fallidas };
    }

    /**
     * Devuelve los idReceta de las filas que todavía no tienen numero_receta cargado.
     */
    async getIdRecetasSinNumero(): Promise<number[]> {
        const filas = await this.recetaAuditaRepository.find({
            select: { idReceta: true },
            where: { numeroReceta: IsNull() },
        });
        return filas.map((f) => f.idReceta);
    }

    /**
     * Devuelve los idReceta de las filas que todavía no tienen id_global cargado.
     */
    async getIdRecetasSinIdGlobal(): Promise<number[]> {
        const filas = await this.recetaAuditaRepository
            .createQueryBuilder('receta')
            .select('receta.idReceta', 'idReceta')
            .where('receta.idGlobal IS NULL')
            .getRawMany<{ idReceta: number }>();

        return filas.map((f) => f.idReceta);
    }

    /**
     * Devuelve los idReceta de las filas que todavía no tienen ref_id_global cargado.
     */
    async getIdRecetasSinRefIdGlobal(): Promise<number[]> {
        const filas = await this.recetaAuditaRepository
            .createQueryBuilder('receta')
            .select('receta.idReceta', 'idReceta')
            .where('receta.refIdGlobal IS NULL')
            .getRawMany<{ idReceta: number }>();

        return filas.map((f) => f.idReceta);
    }

    /**
     * Actualiza numero_receta en lotes a partir de un mapa idReceta -> NumReceta.
     * Solo pisa filas donde numero_receta sigue en NULL.
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
          AND r.numero_receta IS NULL
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

    /**
     * Actualiza id_global en lotes a partir de un mapa idReceta -> idGlobal.
     * Solo pisa filas donde id_global sigue en NULL.
     */
    async backfillIdGlobal(
        valores: { idReceta: number; idGlobal: number | null }[],
        chunkSize = 10000,
    ): Promise<{ total: number; actualizadas: number }> {
        let actualizadas = 0;

        for (let i = 0; i < valores.length; i += chunkSize) {
            const chunk = valores.slice(i, i + chunkSize);

            const params: (number | null)[] = [];
            const tuples = chunk
                .map((v, idx) => {
                    params.push(v.idReceta, v.idGlobal);
                    return `($${idx * 2 + 1}, $${idx * 2 + 2})`;
                })
                .join(', ');

            const sql = `
        UPDATE "receta-auditado" AS r
        SET id_global = v.id_global::bigint
        FROM (VALUES ${tuples}) AS v(id_receta, id_global)
        WHERE r.id_receta = v.id_receta::int
          AND r.id_global IS NULL
        RETURNING r.id_receta;
      `;

            const result = await this.recetaAuditaRepository.query<{ id_receta: number }[]>(
                sql,
                params,
            );
            actualizadas += Array.isArray(result) ? result.length : 0;
            this.logger.debug(
                `🔁 Backfill idGlobal lote ${i / chunkSize + 1}: ${chunk.length} filas procesadas`,
            );
        }

        this.logger.log(
            `📊 Backfill id_global → Total candidatas: ${valores.length} | Actualizadas: ${actualizadas}`,
        );
        return { total: valores.length, actualizadas };
    }

    /**
     * Actualiza ref_id_global en lotes a partir de un mapa idReceta -> RefIDGlobal.
     * Solo pisa filas donde ref_id_global sigue en NULL.
     */
    async backfillRefIdGlobal(
        valores: { idReceta: number; refIdGlobal: number | null }[],
        chunkSize = 10000,
    ): Promise<{ total: number; actualizadas: number }> {
        let actualizadas = 0;

        for (let i = 0; i < valores.length; i += chunkSize) {
            const chunk = valores.slice(i, i + chunkSize);

            const params: (number | null)[] = [];
            const tuples = chunk
                .map((v, idx) => {
                    params.push(v.idReceta, v.refIdGlobal);
                    return `($${idx * 2 + 1}, $${idx * 2 + 2})`;
                })
                .join(', ');

            const sql = `
        UPDATE "receta-auditado" AS r
        SET ref_id_global = v.ref_id_global::bigint
        FROM (VALUES ${tuples}) AS v(id_receta, ref_id_global)
        WHERE r.id_receta = v.id_receta::int
          AND r.ref_id_global IS NULL
        RETURNING r.id_receta;
      `;

            const result = await this.recetaAuditaRepository.query<{ id_receta: number }[]>(
                sql,
                params,
            );
            actualizadas += Array.isArray(result) ? result.length : 0;
            this.logger.debug(
                `🔁 Backfill refIdGlobal lote ${i / chunkSize + 1}: ${chunk.length} filas procesadas`,
            );
        }

        this.logger.log(
            `📊 Backfill ref_id_global → Total candidatas: ${valores.length} | Actualizadas: ${actualizadas}`,
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
