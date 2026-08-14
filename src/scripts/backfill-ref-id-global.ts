import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PlexService } from '../plex/plex.service';
import { BackfillModule } from './backfill.module';

/**
 * Script one-shot para backfillear la columna ref_id_global en las filas
 * históricas de receta-auditado (Postgres), tomando el valor resuelto desde factlineas por IDReceta.
 *
 * Uso:  ts-node src/scripts/backfill-ref-id-global.ts
 *       (o el compilado: node dist/scripts/backfill-ref-id-global)
 */
async function bootstrap() {
    const logger = new Logger('BackfillRefIdGlobal');

    const app = await NestFactory.createApplicationContext(BackfillModule, {
        logger: ['error', 'warn', 'log', 'debug'],
    });

    try {
        const auditoriaService = app.get(AuditoriaService);
        const plexService = app.get(PlexService);

        const idRecetas = await auditoriaService.getIdRecetasSinRefIdGlobal();
        logger.log(`🔎 ${idRecetas.length} recetas sin ref_id_global`);

        if (idRecetas.length === 0) {
            logger.log('✅ Nada que backfillear. Saliendo.');
            return;
        }

        const filasPlex = await plexService.getRefIdGlobalByIds(idRecetas);
        const valores = filasPlex.map((f) => ({
            idReceta: f.IDReceta,
            refIdGlobal: f.RefIDGlobal ?? null,
        }));

        const sinMatch = idRecetas.length - valores.length;
        if (sinMatch > 0) {
            logger.warn(
                `⚠️ ${sinMatch} recetas no devolvieron RefIDGlobal en Plex (quedan en NULL)`,
            );
        }

        const resultado = await auditoriaService.backfillRefIdGlobal(valores);
        logger.log(
            `🏁 Backfill finalizado → Candidatas: ${resultado.total} | Actualizadas: ${resultado.actualizadas}`,
        );
    } catch (err) {
        logger.error('❌ Error en el backfill', err instanceof Error ? err.stack : String(err));
        process.exitCode = 1;
    } finally {
        await app.close();
    }
}

void bootstrap();
