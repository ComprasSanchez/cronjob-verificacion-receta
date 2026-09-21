import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AuditoriaService } from './auditoria.service';
import { RecetaAuditado } from './entities/recetas.entity';
import { CajaAuditada } from './entities/caja-auditada.entity';
import { IRecetaAuditado } from './interface/receta-auditada.interface';
import { COLUMNAS_PROTEGIDAS, COLUMNAS_SINCRONIZADAS_DESDE_PLEX } from './columnas-sincronizadas';

/**
 * REGRESION: EL CRON NO PUEDE DESTRUIR EL PISTOLEO.
 *
 * En produccion, 268.188 de 272.076 recetas pistoleadas (98,57%) habian
 * perdido su `estado = true` porque este cron hacia un upsert de la fila
 * entera y lo devolvia a `null` en cada corrida.
 *
 * Estos tests miran la unica cosa que importa: que columnas quedan del lado
 * del `DO UPDATE SET`. Si alguien vuelve a poner `repository.upsert()` o mete
 * `estado` en la whitelist, esto se pone rojo.
 */

/**
 * Espia del query builder. Devuelve `this` en cada paso de la cadena y guarda
 * lo que recibio `orUpdate`, que es el dato bajo prueba.
 */
const crearQueryBuilderEspia = () => {
    const capturado: { overwrite?: string[]; conflictTarget?: string[] } = {};
    const qb: any = {
        insert: () => qb,
        into: () => qb,
        values: () => qb,
        orUpdate: (overwrite: string[], conflictTarget: string[]) => {
            capturado.overwrite = overwrite;
            capturado.conflictTarget = conflictTarget;
            return qb;
        },
        execute: async () => ({ raw: [], identifiers: [], generatedMaps: [] }),
    };
    return { qb, capturado };
};

const receta = (over: Partial<IRecetaAuditado> = {}): IRecetaAuditado =>
    ({
        idComprobante: 1,
        comprobante: 'FV-B-72-444483',
        idReceta: 8263518195305,
        idRecetaGlobal: null,
        numeroReceta: '8263518195305',
        idGlobal: 10,
        refIdGlobal: null,
        idCaja: 10,
        fechaAperturaCaja: new Date('2026-08-01'),
        fechaCierreCaja: new Date('2026-08-01'),
        sucursal: 5,
        idObSocPlex: 1950,
        descripcionSucursal: 'PAMI CONVENIO FMLK',
        fechaEmision: new Date('2026-08-01'),
        fechaPrescipcion: new Date('2026-08-01'),
        fechaDispensacion: new Date('2026-08-01'),
        codAutorizacion: '20260801021430856100',
        totalReceta: 100,
        totalACOS: 80,
        operador: 'ROCIO',
        auditada: false,
        irregular: false,
        estado: null,
        ...over,
    }) as IRecetaAuditado;

describe('AuditoriaService :: bulkRecetaAudita', () => {
    let service: AuditoriaService;
    let espia: ReturnType<typeof crearQueryBuilderEspia>;
    let repo: any;

    beforeEach(async () => {
        espia = crearQueryBuilderEspia();
        repo = {
            find: jest.fn().mockResolvedValue([]),
            createQueryBuilder: jest.fn(() => espia.qb),
            upsert: jest.fn(),
        };

        const modulo: TestingModule = await Test.createTestingModule({
            providers: [
                AuditoriaService,
                {
                    provide: getRepositoryToken(RecetaAuditado, 'postgresConnection'),
                    useValue: repo,
                },
                { provide: getRepositoryToken(CajaAuditada, 'postgresConnection'), useValue: {} },
            ],
        }).compile();

        service = modulo.get<AuditoriaService>(AuditoriaService);
    });

    test('1. el UPDATE no incluye `estado`: una receta pistoleada no puede volver a null', async () => {
        await service.bulkRecetaAudita([receta({ estado: null })]);

        expect(espia.capturado.overwrite).toBeDefined();
        expect(espia.capturado.overwrite).not.toContain('estado');
    });

    test('2. el UPDATE no incluye ninguna columna protegida', async () => {
        await service.bulkRecetaAudita([receta()]);

        for (const protegida of COLUMNAS_PROTEGIDAS) {
            expect(espia.capturado.overwrite).not.toContain(protegida);
        }
    });

    test('3. el conflicto se resuelve por id_receta', async () => {
        await service.bulkRecetaAudita([receta()]);

        expect(espia.capturado.conflictTarget).toEqual(['id_receta']);
    });

    test('4. SI refresca los datos que vienen de Plex', async () => {
        await service.bulkRecetaAudita([receta()]);

        expect(espia.capturado.overwrite).toEqual(
            expect.arrayContaining([
                'comprobante',
                'numero_receta',
                'id_global',
                'fecha_dispensacion',
                'codigo_autorizacion',
                'total_receta',
                'operador',
            ]),
        );
    });

    test('5. NO se usa repository.upsert(): ese camino pisa la fila entera', async () => {
        await service.bulkRecetaAudita([receta()]);

        expect(repo.upsert).not.toHaveBeenCalled();
        expect(repo.createQueryBuilder).toHaveBeenCalled();
    });

    test('6. sin recetas no toca la base', async () => {
        const resultado = await service.bulkRecetaAudita([]);

        expect(repo.createQueryBuilder).not.toHaveBeenCalled();
        expect(resultado).toEqual({ total: 0, insertadas: 0, actualizadas: 0, fallidas: 0 });
    });

    test('7. divide en chunks: 1200 recetas con chunk 500 -> 3 ejecuciones', async () => {
        const muchas = Array.from({ length: 1200 }, (_, i) => receta({ idReceta: i + 1 }));

        await service.bulkRecetaAudita(muchas, 500);

        expect(repo.createQueryBuilder).toHaveBeenCalledTimes(3);
    });
});

describe('columnas-sincronizadas', () => {
    test('8. whitelist y protegidas no se solapan', () => {
        const interseccion = COLUMNAS_SINCRONIZADAS_DESDE_PLEX.filter((c) =>
            (COLUMNAS_PROTEGIDAS as readonly string[]).includes(c),
        );

        expect(interseccion).toEqual([]);
    });

    test('9. `estado` sigue estando declarado como protegido', () => {
        // Si alguien lo saca de la lista, el cron vuelve a poder borrarlo.
        expect(COLUMNAS_PROTEGIDAS).toContain('estado');
    });
});
