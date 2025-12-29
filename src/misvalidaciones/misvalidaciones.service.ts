import { Injectable, Logger } from '@nestjs/common';
import { RecetaResponse } from './misvañidaciones.interface';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
type Credencial = { username: string; password: string };

@Injectable()
export class MisvalidacionesService {
    private readonly logger = new Logger(MisvalidacionesService.name);

    private readonly claves_sucursales: Record<string, { username: string; password: string }> = {
        '1': { username: 'CB401429', password: '505899' },
    };

    constructor(private readonly configService: ConfigService) {}

    private getCredentials(id: number): Credencial | undefined {
        const username = this.configService.get<string>(`USERNAME_${id}`);
        const password = this.configService.get<string>(`PASSWORD_${id}`);

        if (!username || !password) {
            return undefined;
        }

        return { username, password };
    }

    async getRecetas(
        sucursal: number,
        cod_validacion: string,
    ): Promise<RecetaResponse | undefined> {
        try {
            const auth = this.getCredentials(sucursal)
            const receta = await axios.get<RecetaResponse>(
                'https://www.misvalidaciones.com.ar/receta',
                {
                    params: {
                        clave_id: this.configService.get<string>('MIS_VALIDACIONES_ID'),
                        cod_validacion,
                    },
                    auth: auth,
                },
            );

            return receta.data;
        } catch (error) {
            this.logger.warn(
                `❌ Error al obtener receta de MisValidaciones (Sucursal: ${sucursal}, Cod: ${cod_validacion})`,
                error instanceof Error ? error.message : String(error),
            );
            return undefined;
        }
    }
}
