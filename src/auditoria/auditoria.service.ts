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
                    this.logger.debug(
                        `🆕 Receta insertada (IDReceta: ${receta.idReceta}, IDComprobante: ${receta.idComprobante})`,
                    );
                } else {
                    actualizadas++;
                    this.logger.debug(
                        `🔁 Receta actualizada (IDReceta: ${receta.idReceta}, IDComprobante: ${receta.idComprobante})`,
                    );
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

    async getCajaSegunGlobal(idGlobal: number): Promise<number> {
        const caja = await this.cajaAuditaba.findOne({ where: { idGlobal } });
        if (caja) {
            this.logger.debug(`Caja encontrada ${caja.id}`);
            return caja.id;
        }
        return idGlobal;
    }
}
