import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { MisvalidacionesModule } from './misvalidaciones/misvalidaciones.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { plexDatabase } from './config/database.config';
import { PlexModule } from './plex/plex.module';

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
        ScheduleModule.forRoot(),
        MisvalidacionesModule,
        PlexModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
