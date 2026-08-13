import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PlexService } from '../plex/plex.service';
import { BackfillModule } from './backfill.module';

/**
 * Script one-shot para backfillear la columna id_comprobante_ref en las filas
 * históricas NC de receta-auditado (Postgres), tomando el valor desde Plex por IDReceta.
 *
 * Uso:  ts-node src/scripts/backfill-id-comprobante-ref.ts
 *       (o el compilado: node dist/scripts/backfill-id-comprobante-ref)
 */
async function bootstrap() {
    const logger = new Logger('BackfillIdComprobanteRef');

    const app = await NestFactory.createApplicationContext(BackfillModule, {
        logger: ['error', 'warn', 'log', 'debug'],
    });

    try {
        const auditoriaService = app.get(AuditoriaService);
        const plexService = app.get(PlexService);

        const idRecetas = await auditoriaService.getIdRecetasSinIdComprobanteRef();
        logger.log(`🔎 ${idRecetas.length} recetas NC sin id_comprobante_ref`);

        if (idRecetas.length === 0) {
            logger.log('✅ Nada que backfillear. Saliendo.');
            return;
        }

        const filasPlex = await plexService.getIdComprobanteRefByIds(idRecetas);
        const valores = filasPlex.map((f) => ({
            idReceta: f.IDReceta,
            idComprobanteRef: f.IDComprobanteRef ?? null,
        }));

        const sinMatch = idRecetas.length - valores.length;
        if (sinMatch > 0) {
            logger.warn(
                `⚠️ ${sinMatch} recetas NC no devolvieron IDComprobanteRef en Plex (quedan en NULL)`,
            );
        }

        const resultado = await auditoriaService.backfillIdComprobanteRef(valores);
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
