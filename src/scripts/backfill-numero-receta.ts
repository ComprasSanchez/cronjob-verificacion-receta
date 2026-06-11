import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PlexService } from '../plex/plex.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

/**
 * Script one-shot para backfillear la columna numero_receta en las filas
 * históricas de receta-auditado (Postgres), tomando el valor desde Plex (MySQL).
 *
 * Uso:  ts-node src/scripts/backfill-numero-receta.ts
 *       (o el compilado: node dist/scripts/backfill-numero-receta)
 */
async function bootstrap() {
    const logger = new Logger('BackfillNumeroReceta');

    // Solo contexto de DI, sin levantar el servidor HTTP ni el cron.
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn', 'log', 'debug'],
    });

    try {
        const auditoriaService = app.get(AuditoriaService);
        const plexService = app.get(PlexService);

        // 1. Filas en Postgres sin numero_receta
        const idRecetas = await auditoriaService.getIdRecetasSinNumero();
        logger.log(`🔎 ${idRecetas.length} recetas sin numero_receta`);

        if (idRecetas.length === 0) {
            logger.log('✅ Nada que backfillear. Saliendo.');
            return;
        }

        // 2. Buscar el NumReceta en Plex por IDReceta
        const filasPlex = await plexService.getNumRecetasByIds(idRecetas);
        const valores = filasPlex.map((f) => ({
            idReceta: f.IDReceta,
            numeroReceta: f.NumReceta ?? null,
        }));

        const sinMatch = idRecetas.length - valores.length;
        if (sinMatch > 0) {
            logger.warn(`⚠️ ${sinMatch} recetas no se encontraron en Plex (quedan en NULL)`);
        }

        // 3. Actualizar Postgres en lotes
        const resultado = await auditoriaService.backfillNumeroReceta(valores);
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
