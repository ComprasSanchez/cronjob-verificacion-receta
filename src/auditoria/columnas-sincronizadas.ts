/**
 * QUE COLUMNAS DE `receta-auditado` LE PERTENECEN A ESTE CRON.
 *
 * EL PROBLEMA QUE ESTE ARCHIVO EXISTE PARA IMPEDIR
 * ------------------------------------------------
 * Este cron sincroniza recetas desde Plex. Hasta ahora lo hacia con
 * `repository.upsert(chunk, ['idReceta'])`, que TypeORM traduce a un
 * `ON CONFLICT (id_receta) DO UPDATE SET <TODAS las columnas>`.
 *
 * "TODAS las columnas" incluia `estado` y `auditado`, que este cron NO calcula:
 * los escribe como `null` y `false` literales porque no tiene con que
 * calcularlos. El resultado era que cada corrida pisaba el trabajo de otro
 * proceso.
 *
 * Con la reconciliacion diaria de 90 dias el dano dejo de ser teorico: un
 * operador pistoleaba una receta (`estado = true`), y a las 05:00 del dia
 * siguiente esta sincronizacion la devolvia a `null`. Medido en produccion:
 * 268.188 de 272.076 recetas pistoleadas -- el 98,57% -- habian perdido el
 * flag.
 *
 * LA REGLA
 * --------
 * El cron es dueño de los datos que vienen de Plex. Nada mas. Las columnas que
 * escribe otro proceso (el pistoleo desde la app, la auditoria) no se tocan en
 * el UPDATE.
 *
 * INSERT vs UPDATE: la diferencia importa
 * ---------------------------------------
 * En el INSERT de una receta nueva si se escriben los valores iniciales
 * (`estado = null`, `auditado = false`): una receta que recien aparece en Plex
 * todavia no fue pistoleada ni auditada, y ese es su estado correcto.
 *
 * Lo que esta lista controla es SOLO el UPDATE -- que pasa cuando la fila ya
 * existe. Ahi el cron refresca los datos de Plex y deja intacto todo lo demas.
 */

/**
 * Columnas (nombres de base, que es lo que espera `orUpdate`) que este cron
 * refresca cuando la receta ya existe.
 *
 * Son exactamente las que provienen del SELECT a Plex. Si mañana el SELECT
 * trae un campo nuevo, se agrega aca -- y esa decision explicita es el punto.
 */
export const COLUMNAS_SINCRONIZADAS_DESDE_PLEX = [
    'id_comprobante',
    'comprobante',
    'id_receta_global',
    'numero_receta',
    'id_global',
    'ref_id_global',
    'id_caja',
    'fecha_apertura_caja',
    'fecha_cierre_caja',
    'sucursal',
    'id_ob_soc_plex',
    'descripcion_sucursal',
    'fecha_emision',
    'fecha_prescripcion',
    'fecha_dispensacion',
    'codigo_autorizacion',
    'total_receta',
    'total_acos',
    'operador',
    // `auditado` e `irregular` siguen aca, como hasta hoy. Este cron tampoco
    // los calcula -- los escribe en `false` fijo desde que se removio
    // MisValidaciones --, asi que en rigor tampoco le pertenecen. Pero sacarlos
    // cambiaria el comportamiento de la columna `Auditada`, y esa es una
    // decision de la tarea de Auditada, no de esta. Cuando se encare, mudarlos
    // a COLUMNAS_PROTEGIDAS es todo lo que hay que hacer.
    'auditado',
    'irregular',
] as const;

/**
 * Columnas que este cron NO puede tocar en un UPDATE, y por que.
 *
 * - `estado`   -> lo escribe el pistoleo desde la app (`PATCH /auditoria/recetas/estado`).
 *                 El evento durable vive en `historia-pistoleo-detalle`; esta
 *                 columna es un cache de eso.
 * `auditado` e `irregular` estan en el mismo caso -- el cron tampoco los
 * calcula -- pero NO se protegen aca: tocarlos cambiaria el comportamiento de
 * la columna `Auditada`, que es alcance de otra tarea.
 *
 * Se exporta para que el test de regresion pueda afirmar la invariante sin
 * repetir la lista a mano.
 */
export const COLUMNAS_PROTEGIDAS = ['estado'] as const;

/** Columna sobre la que se resuelve el conflicto del UPSERT. */
export const CONFLICTO_UPSERT = ['id_receta'] as const;
