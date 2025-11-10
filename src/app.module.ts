import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { MisvalidacionesModule } from './misvalidaciones/misvalidaciones.module';

@Module({
    imports: [ScheduleModule.forRoot(), MisvalidacionesModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
