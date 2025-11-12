import { Injectable, Logger } from '@nestjs/common';
import { RecetaResponse } from './misvañidaciones.interface';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MisvalidacionesService {
    private readonly logger = new Logger(MisvalidacionesService.name);

    private readonly claves_sucursales: Record<string, { username: string; password: string }> = {
        '1': { username: 'CB401429', password: '505899' },
    };

    constructor(private readonly configService: ConfigService) {}

    async getRecetas(
        sucursal: number,
        cod_validacion: string,
    ): Promise<RecetaResponse | undefined> {
        try {
            const receta = await axios.get<RecetaResponse>(
                'https://www.misvalidaciones.com.ar/receta',
                {
                    params: {
                        clave_id: this.configService.get<string>('MIS_VALIDACIONES_ID'),
                        cod_validacion,
                    },
                    auth: this.claves_sucursales[sucursal],
                },
            );

            return receta.data;
        } catch (error) {
            this.logger.error(
                `❌ Error al obtener receta de MisValidaciones (Sucursal: ${sucursal}, Cod: ${cod_validacion})`,
                error instanceof Error ? error.message : String(error),
            );
            return undefined;
        }
    }
}
