import { Injectable, Logger } from '@nestjs/common';
import { RecetaResponse } from './misvañidaciones.interface';
import axios from 'axios';

@Injectable()
export class MisvalidacionesService {
    private readonly logger = new Logger(MisvalidacionesService.name);

    private readonly claves_sucursales: Record<number, string> = {
        1: '98c5c54681ww9f32c711',
    };

    async getRecetas(sucursal: number, cod_validacion: string): Promise<RecetaResponse> {
        const receta = await axios.get<RecetaResponse>(
            'https://www.misvalidaciones.com.ar/receta',
            {
                params: {
                    clave_id: this.claves_sucursales[sucursal],
                    cod_validacion,
                },
                auth: {
                    username: 'CB401429',
                    password: '505899',
                },
                validateStatus: (status) => status === 200 || status === 400,
            },
        );

        this.logger.log({ receta: receta.data, sucursal, cod_validacion });
        return receta.data;
    }
}
