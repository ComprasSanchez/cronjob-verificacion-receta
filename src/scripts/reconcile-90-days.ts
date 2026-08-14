import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AppService } from '../app.service';
import { PlexService } from '../plex/plex.service';
import { BackfillModule } from './backfill.module';

async function bootstrap() {
    const logger = new Logger('Reconcile90Days');

    const app = await NestFactory.createApplicationContext(BackfillModule, {
        logger: ['error', 'warn', 'log', 'debug'],
    });

    try {
        logger.log('🕔 Ejecutando reconciliacion manual de 90 dias...');
        const appService = new AppService(app.get(AuditoriaService), app.get(PlexService));
        await appService.reconciliarUltimos90Dias();
        logger.log('🏁 Reconciliacion manual finalizada.');
    } catch (err) {
        logger.error(
            '❌ Error en la reconciliacion manual',
            err instanceof Error ? err.stack : String(err),
        );
        process.exitCode = 1;
    } finally {
        await app.close();
    }
}

void bootstrap();
