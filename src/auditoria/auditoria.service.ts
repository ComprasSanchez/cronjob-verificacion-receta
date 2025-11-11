import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RecetaAuditado } from './entities/recetas.entity';
import { Repository } from 'typeorm';
import { IRecetaAuditado } from './interface/receta-auditada.interface';

@Injectable()
export class AuditoriaService {
    constructor(
        @InjectRepository(RecetaAuditado, 'postgresConnection')
        private receteAuditaRepostiy: Repository<RecetaAuditado>,
    ) {}

    async bulkRecetaAudita(recetas: IRecetaAuditado[]) {
        // Convert idComprobante to string (as required by RecetaAuditado entity)
        const recetaInstances = recetas.map((receta) => this.receteAuditaRepostiy.create(receta));
        await this.receteAuditaRepostiy.save(recetaInstances);
    }
}
