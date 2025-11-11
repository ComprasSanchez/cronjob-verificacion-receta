import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { MisvalidacionesModule } from './misvalidaciones/misvalidaciones.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { auditoriaDatabase, plexDatabase } from './config/database.config';
import { PlexModule } from './plex/plex.module';
import { AuditoriaModule } from './auditoria/auditoria.module';

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
        ScheduleModule.forRoot(),
        MisvalidacionesModule,
        PlexModule,
        AuditoriaModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
