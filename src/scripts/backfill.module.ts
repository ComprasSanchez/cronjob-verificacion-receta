import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { auditoriaDatabase, plexDatabase } from '../config/database.config';
import { PlexModule } from '../plex/plex.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

/**
 * Módulo mínimo para scripts one-shot (ej: backfill).
 * Reusa las conexiones y los módulos de datos PERO no incluye AppService,
 * por lo que NO dispara el onModuleInit que ejecuta validarRecetas().
 */
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        TypeOrmModule.forRootAsync({
            name: 'mysql-plex',
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: plexDatabase,
        }),
        TypeOrmModule.forRootAsync({
            name: 'postgresConnection',
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: auditoriaDatabase,
        }),
        PlexModule,
        AuditoriaModule,
    ],
})
export class BackfillModule {}
