import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
// import { CajaAuditada } from 'src/auditoria/entities/caja-auditada.entity';
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
    synchronize: false,
    logging: false,
    extra: {
        connectionLimit: configService.get<number>('DB_CONNECTION_LIMIT', 10),
    },
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
    synchronize: true,
    logging: false,
    ssl:
        configService.get<string>('PG_SSL') === 'true'
            ? {
                rejectUnauthorized: false,
            }
            : false,
});
