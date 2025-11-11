import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RecetaAuditado } from './entities/recetas.entity';
import { Repository } from 'typeorm';
import { IRecetaAuditado } from './interface/receta-auditada.interface';

@Injectable()
export class AuditoriaService {
    private readonly logger = new Logger(AuditoriaService.name);

    constructor(
        @InjectRepository(RecetaAuditado, 'postgresConnection')
        private readonly recetaAuditaRepository: Repository<RecetaAuditado>,
    ) {}

    async bulkRecetaAudita(recetas: IRecetaAuditado[]) {
        if (!recetas?.length) {
            this.logger.warn('⚠️ No se recibieron recetas para auditar.');
            return { total: 0, exitosas: 0, fallidas: 0 };
        }

        this.logger.log(`📦 Iniciando guardado masivo de ${recetas.length} recetas auditadas...`);

        const resultados = await Promise.allSettled(
            recetas.map(async (receta) => {
                try {
                    const entidad = this.recetaAuditaRepository.create(receta);
                    const guardada = await this.recetaAuditaRepository.save(entidad);
                    this.logger.debug(
                        `✅ Receta auditada guardada (IDComprobante: ${receta.idComprobante}, IDReceta: ${receta.idReceta})`,
                    );
                    return guardada;
                } catch (error) {
                    this.logger.error(
                        `❌ Error guardando receta (IDComprobante: ${receta.idComprobante}, IDReceta: ${receta.idReceta})`,
                        error instanceof Error ? error.message : String(error),
                    );
                    throw error;
                }
            }),
        );

        // Contar resultados
        const exitosas = resultados.filter((r) => r.status === 'fulfilled').length;
        const fallidas = resultados.filter((r) => r.status === 'rejected').length;

        this.logger.log(
            `📊 Resultado guardado masivo → Total: ${recetas.length} | Exitosas: ${exitosas} | Fallidas: ${fallidas}`,
        );

        return {
            total: recetas.length,
            exitosas,
            fallidas,
        };
    }
}
