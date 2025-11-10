import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlexService } from './plex.service';

@Module({
    imports: [TypeOrmModule.forFeature([], 'mysql-plex')],
    providers: [PlexService],
    exports: [PlexService],
})
export class PlexModule {}
