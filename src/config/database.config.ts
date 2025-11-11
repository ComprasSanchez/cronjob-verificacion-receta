import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { RecetaAuditado } from 'src/auditoria/entities/recetas.entity';

export const plexDatabase = (configService: ConfigService): TypeOrmModuleOptions => ({
    name: 'mysql-plex',
    type: 'mysql',
    host: configService.get<string>('DB_HOST'),
    port: configService.get<number>('DB_PORT'),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_NAME'),
    entities: [],
    synchronize: true,
    logging: false,
});

export const auditoriaDatabase = (configService: ConfigService): TypeOrmModuleOptions => ({
    name: 'postgresConnection',
    type: 'postgres',
    host: configService.get<string>('PG_HOST'),
    port: configService.get<number>('PG_PORT', 5432),
    username: configService.get<string>('PG_USERNAME'),
    password: configService.get<string>('PG_PASSWORD'),
    database: configService.get<string>('PG_DATABASE'),
    entities: [RecetaAuditado],
    synchronize: process.env.NODE_ENV !== 'production',
    // synchronize: true,
    logging: false,
    // logging: true,
    ssl:
        configService.get<string>('PG_SSL') === 'true'
            ? {
                  rejectUnauthorized: false,
              }
            : false,
});
