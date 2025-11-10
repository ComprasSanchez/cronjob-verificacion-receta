import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

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
