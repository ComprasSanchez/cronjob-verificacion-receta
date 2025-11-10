import { Module } from '@nestjs/common';
import { MisvalidacionesService } from './misvalidaciones.service';

@Module({
    providers: [MisvalidacionesService],
    exports: [MisvalidacionesService],
})
export class MisvalidacionesModule {}
