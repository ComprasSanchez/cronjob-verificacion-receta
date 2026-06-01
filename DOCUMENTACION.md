# Documentación Técnica — Cronjob Verificación Receta

> Generada en mayo 2026. Cubre el cron-job de auditoría automática de recetas farmacéuticas.

---

## Índice

1. [Descripción General](#1-descripción-general)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Base de Datos](#4-base-de-datos)
5. [Entidades](#5-entidades)
6. [Flujo de Ejecución](#6-flujo-de-ejecución)
7. [Consulta SQL a Plex](#7-consulta-sql-a-plex)
8. [Integración MisValidaciones](#8-integración-misvalidaciones)
9. [Lógica de Matching de Precios](#9-lógica-de-matching-de-precios)
10. [Mapa de Obras Sociales](#10-mapa-de-obras-sociales)
11. [UPSERT a PostgreSQL](#11-upsert-a-postgresql)
12. [Cron Schedule](#12-cron-schedule)
13. [Módulos y Servicios](#13-módulos-y-servicios)
14. [Variables de Entorno](#14-variables-de-entorno)

---

## 1. Descripción General

`cronjob-verificacion-receta` es un **cron-job** que se ejecuta cada 6 horas. Su responsabilidad es:

1. Consultar todas las recetas dispensadas en el rango de fechas actual desde el sistema Plex (MySQL).
2. Para cada receta, determinar si su obra social usa el servicio de validación **MisValidaciones** o no.
3. Si usa MisValidaciones: llamar a la API externa y comparar los precios de la receta (total e importe ACOS) contra los datos del sistema farmacéutico.
4. Persistir el resultado en PostgreSQL mediante **UPSERT** por `idReceta`, en la tabla `receta-auditado`.

Esta tabla es la misma que consume `altas-cajas` para el flujo de **pistoleos de recetas**. El cron la mantiene actualizada para que el auditor pueda pistolar recetas con información ya validada.

Puerto: **3000** (configurable con `PORT`)

---

## 2. Stack Tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| Node.js | — | Runtime |
| NestJS | v11.0.1 | Framework |
| `@nestjs/schedule` | v6.0.1 | Cron jobs |
| `@nestjs/typeorm` | v11.0.0 | ORM |
| TypeORM | v0.3.27 | Abstracción de bases de datos |
| `@nestjs/axios` | v4.0.1 | HTTP client wrapper |
| axios | v1.13.2 | Llamadas HTTP externas |
| MySQL (`mysql`) | v2.18.1 | Driver para Plex |
| PostgreSQL (`pg`) | v8.16.3 | Driver para auditoría |

---

## 3. Arquitectura del Sistema

```
┌──────────────────────────────────────────────────────────┐
│             cronjob-verificacion-receta                   │
│                                                           │
│  @Cron(EVERY_6_HOURS) + onModuleInit()                   │
│           │                                               │
│           ↓                                               │
│       AppService.validarRecetas()                         │
│           │                                               │
│    ┌──────┴──────────────────────┐                        │
│    │                             │                        │
│    ↓                             ↓                        │
│  PlexService               MisvalidacionesService         │
│  (MySQL query)             (API externa por sucursal)     │
│           │                             │                 │
│           └──────────┬──────────────────┘                 │
│                      ↓                                    │
│               AuditoriaService                            │
│               (UPSERT PostgreSQL)                         │
└────┬──────────────────────────────────────────────────────┘
     │
     ├──→  MySQL Plex         (reccabecera, factcabecera, obsociales, cajapartes)
     └──→  PostgreSQL Audit   (receta-auditado, caja-auditada)
```

### Conexiones TypeORM

| Nombre | Base | Tipo | `synchronize` |
|--------|------|------|---------------|
| `mysql-plex` | Plex | MySQL | `false` |
| `postgresConnection` | Auditoría | PostgreSQL Railway | `false` |

> `synchronize: false` en ambas conexiones — nunca corre DDL al reiniciar.

---

## 4. Base de Datos

### MySQL — Plex (solo lectura)

Tablas consultadas durante el cron:

| Tabla | Uso |
|-------|-----|
| `reccabecera` | Cabecera de cada receta farmacéutica |
| `factcabecera` | Comprobantes de venta vinculados a la receta |
| `obsociales` | Obras sociales con su código (`CodObSoc`) |
| `operadores` | Usuarios / operadores del sistema |
| `cajapartes` | Cajas para obtener `idGlobal`, fechas apertura/cierre |

---

### PostgreSQL — Auditoría

Tablas escritas por el cron:

#### `receta-auditado`

Resultado de la auditoría de cada receta. Es la tabla que consume `altas-cajas` para el flujo de pistoleos.

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| id | int (auto) | No | PK |
| id_comprobante | int | No | ID del comprobante en Plex |
| comprobante | varchar | No | Número formateado: `Tipo-Letra-PuntoVta-Numero` |
| id_receta | int UNIQUE | No | ID de la receta en Plex (clave del UPSERT) |
| id_receta_global | varchar | Sí | ID global de la receta |
| id_caja | int | Sí | Caja asociada (FK a `caja-auditada`) |
| fecha_apertura_caja | timestamp | Sí | Fecha apertura de la caja |
| fecha_cierre_caja | timestamp | Sí | Fecha cierre de la caja |
| sucursal | int | Sí | Número de sucursal |
| id_ob_soc_plex | int | No | Código de obra social en Plex |
| descripcion_sucursal | varchar | No | Nombre de la obra social |
| fecha_emision | date | Sí | Fecha de emisión de la receta |
| fecha_prescripcion | date | Sí | Fecha de prescripción del médico |
| fecha_dispensacion | date | No | Fecha de dispensación (venta) |
| codigo_autorizacion | varchar | Sí | Código de autorización de la obra social |
| total_receta | decimal | No | Importe total de la receta |
| total_acos | decimal(15,2) | No | Importe cubierto por obra social (default 0) |
| operador | varchar | No | Operador que procesó la receta |
| auditada | boolean | No | `true` si los precios coinciden con MisValidaciones |
| irregular | boolean | No | `true` si es comprobante tipo `FV` con `IDComprobanteRef` |
| estado | boolean | Sí | `null`=no procesada, `true`=pistoleada |

> El campo `estado` lo gestiona `altas-cajas` (pistoleos). El cron solo escribe `auditada` e `irregular`.

---

#### `caja-auditada`

El cron lee esta tabla para resolver el `id_caja` de cada receta según el `idGlobal` de la caja de Plex.

Estructura idéntica a la documentada en `altas-cajas/DOCUMENTACION.md` sección 4.1.

---

## 5. Entidades

### `RecetaAuditado` — `receta-auditado`

```typescript
@Entity('receta-auditado')
@Unique(['id_receta'])
export class RecetaAuditado {
  @PrimaryGeneratedColumn() id: number;
  @Column() id_comprobante: number;
  @Column() comprobante: string;
  @Column() id_receta: number;           // clave UPSERT
  @Column({ nullable: true }) id_receta_global: string;
  @Column({ nullable: true }) id_caja: number;
  @Column({ nullable: true }) fecha_apertura_caja: Date;
  @Column({ nullable: true }) fecha_cierre_caja: Date;
  @Column({ nullable: true }) sucursal: number;
  @Column() id_ob_soc_plex: number;
  @Column() descripcion_sucursal: string;
  @Column({ nullable: true }) fecha_emision: Date;
  @Column({ nullable: true }) fecha_prescripcion: Date;
  @Column() fecha_dispensacion: Date;
  @Column({ nullable: true }) codigo_autorizacion: string;
  @Column() total_receta: number;
  @Column({ default: 0 }) total_acos: number;
  @Column() operador: string;
  @Column() auditada: boolean;
  @Column() irregular: boolean;
  @Column({ nullable: true }) estado: boolean;
}
```

---

## 6. Flujo de Ejecución

El método principal es `AppService.validarRecetas()`. Se llama al iniciar la app (`onModuleInit`) y luego cada 6 horas.

```
1. Calcular rango de fechas
   ├── fechaDesde = hoy - 3 días, 00:00:00
   └── fechaHasta = mañana, 23:59:59

2. PlexService.getRecetasPlex(fechaDesde, fechaHasta)
   └── Devuelve todas las recetas dispensadas en el rango

3. Para cada receta:
   ├── Determinar tipo de validación por CodObSoc (obrasocial-api.ts)
   │
   ├── CASO MISVALIDACIONES:
   │   ├── MisvalidacionesService.getRecetas(sucursal, codAutorizacion)
   │   ├── matchPlexWithMisValidaciones() → compara precios
   │   └── auditada = (TotReceta === precio_total && TotACOS === importe_cobertura)
   │
   └── CASO SINAPP u otro:
       └── matchPlexWithoutApp() → auditada = false, irregular = false

4. AuditoriaService.bulkRecetaAudita(resultados)
   └── UPSERT por id_receta → { insertadas, actualizadas, fallidas }

5. Log del resultado
```

---

## 7. Consulta SQL a Plex

Archivo: `src/plex/plex.service.ts`

```sql
SELECT
  factcabecera.IDComprobante,
  reccabecera.IDReceta,
  reccabecera.IdRecetaGlobal,
  cajapartes.idGlobal,
  cajapartes.FechaApertura,
  cajapartes.FechaCierre,
  reccabecera.Sucursal,
  reccabecera.NumReceta,
  obsociales.CodObSoc,
  obsociales.Descripcio,
  reccabecera.AfilNumero,
  reccabecera.AfilNombre,
  reccabecera.FechaEmision,
  reccabecera.FechaPrescripcion,
  reccabecera.FechaDispensacion,
  reccabecera.FechaAutorizacion,
  reccabecera.CodAutorizacion,
  reccabecera.TotReceta,
  reccabecera.TotACOS,
  reccabecera.Presentada,
  reccabecera.Pendiente,
  CONCAT(reccabecera.Tipo, '-', reccabecera.Letra, '-',
         reccabecera.PuntoVta, '-', reccabecera.Numero) AS Comprobante,
  operadores.Operador,
  factcabecera.Tipo,
  factcabecera.IDComprobanteRef
FROM reccabecera
LEFT JOIN factcabecera  ON reccabecera.IDComprobante  = factcabecera.IDComprobante
LEFT JOIN obsociales    ON reccabecera.IDObSoc        = obsociales.CodObSoc
LEFT JOIN operadores    ON reccabecera.IDUsuario      = operadores.IDOperador
LEFT JOIN cajapartes    ON factcabecera.IDCajaParte   = cajapartes.IDCajaParte
WHERE reccabecera.FechaDispensacion BETWEEN ? AND ?
```

**Parámetros:** `fechaDesde` (YYYY-MM-DD) y `fechaHasta` (YYYY-MM-DD)

**Campos clave:**
- `CodObSoc`: determina qué servicio de validación se usa.
- `CodAutorizacion`: código enviado a MisValidaciones para buscar la receta.
- `TotReceta` / `TotACOS`: valores que se comparan contra la respuesta de MisValidaciones.
- `IDComprobanteRef`: si no es `null` en un comprobante tipo `FV`, la receta se marca como `irregular`.
- `idGlobal` de `cajapartes`: permite resolver el `id_caja` en PostgreSQL.

---

## 8. Integración MisValidaciones

Archivo: `src/misvalidaciones/misvalidaciones.service.ts`

### Endpoint

```
GET https://www.misvalidaciones.com.ar/receta
```

### Autenticación

HTTP Basic Auth por sucursal:
- **Username**: variable de entorno `USERNAME_{sucursal}`
- **Password**: variable de entorno `PASSWORD_{sucursal}`

Cada sucursal tiene credenciales propias configuradas en el entorno.

### Query Parameters

| Parámetro | Valor |
|---|---|
| `clave_id` | `MIS_VALIDACIONES_ID` (variable de entorno global) |
| `cod_validacion` | `CodAutorizacion` de la receta en Plex |

### Response

```typescript
interface RecetaResponse {
  tipo_matricula: string;
  nrorecetario: string;
  afiliado_numero: string;
  matricula: number;
  plan_id: number;
  cod_validacion: number;
  status: string;
  convenio: string;
  plan: string;
  cod_operacion: string;
  convenio_id: number;
  fecha_receta: string;        // YYYY-MM-DD
  items: RecetaItem[];         // Líneas de la receta
}

interface RecetaItem {
  precio_total: string;        // Se compara con TotReceta de Plex
  importe_cobertura: string;   // Se compara con TotACOS de Plex
  cantidad: number;
  nombre: string;
  laboratorio: string;
  cod_trazabilidad: string;
  // ... otros campos
}
```

> Si la llamada falla (error HTTP o red), se loguea como `warn` y la receta queda con `auditada: false`. El error no detiene el cron.

---

## 9. Lógica de Matching de Precios

Archivo: `src/app.service.ts` — método `matchPlexWithMisValidaciones()`

El matching compara los totales de la receta en Plex contra los del primer ítem de la respuesta de MisValidaciones:

```typescript
const precio_total      = recetaMV.items[0]?.precio_total;
const importe_cobertura = recetaMV.items[0]?.importe_cobertura;

const auditada =
  Number(recetaPlex.TotReceta) === Number(precio_total) &&
  Number(recetaPlex.TotACOS)   === Number(importe_cobertura);
```

**Regla de irregularidad:**

```typescript
const irregular =
  factcabecera.Tipo === 'FV' && factcabecera.IDComprobanteRef !== null;
```

Una receta es `irregular` si el comprobante de venta (`FV`) tiene referencia a otro comprobante (`IDComprobanteRef`), lo que indica un escenario de devolución o ajuste.

**Para obras sociales sin app** (SINAPP u otras):

```typescript
// matchPlexWithoutApp()
auditada  = false;
irregular = false;
```

No se llama a ninguna API. Se persiste la receta con `auditada: false` para tener trazabilidad completa de todas las recetas del período.

---

## 10. Mapa de Obras Sociales

Archivo: `src/constante/obrasocial-api.ts`

Determina qué servicio de validación usar para cada obra social, por `CodObSoc`.

### MISVALIDACIONES (obras sociales con validación activa)

```
632, 153, 2008, 764, 1751, 26, 849, 1963, 1979, 392,
1695, 82, 126, 246, 672, 1718, 845, 500, 679, 97, 2530, 586
```

### SINAPP (obras sociales sin sistema de validación)

```
689, 80, 674, 2229, 2557, 730, 265, 1890, 1808, 1005,
2215, 137, 1678, 573, 1782, 266, 1708, 625, 1738
```

### Otros (no mapeados)

Se procesa igual que SINAPP: `auditada = false`, sin llamada externa.

---

## 11. UPSERT a PostgreSQL

Archivo: `src/auditoria/auditoria.service.ts` — método `bulkRecetaAudita()`

El cron realiza un **UPSERT individual por `idReceta`** para cada receta del lote:

- Si el `id_receta` **no existe** → INSERT
- Si el `id_receta` **ya existe** → UPDATE de todos los campos de auditoría

Esto permite que el cron se ejecute múltiples veces sobre el mismo rango sin duplicar registros. Las recetas que ya fueron pistoleadas (`estado = true`) se actualizan igualmente en sus campos de auditoría (`auditada`, `total_receta`, etc.), pero el campo `estado` no se toca — es responsabilidad de `altas-cajas`.

**Log de resultado:**
```
"📊 UPSERT finalizado → Total: X | Insertadas: X | Actualizadas: X | Fallidas: X"
```

---

## 12. Cron Schedule

| Trigger | Schedule | Descripción |
|---|---|---|
| `onModuleInit` | Al arrancar la app | Ejecución inmediata al iniciar |
| `@Cron(EVERY_6_HOURS)` | `0 */6 * * *` | 4 veces por día |

**Rango de fechas procesado:**
- `fechaDesde`: 3 días atrás, 00:00:00
- `fechaHasta`: mañana, 23:59:59

La ventana amplia (casi 5 días) garantiza que recetas con dispensación reciente siempre sean recapturadas y actualizadas si su estado de validación cambia.

**Zona horaria:** Argentina (`es-AR` para los logs).

---

## 13. Módulos y Servicios

| Archivo | Responsabilidad | Método clave |
|---|---|---|
| `src/app.service.ts` | Orquesta el cron: fecha, loop, routing por obra social | `validarRecetas()`, `matchPlexWithMisValidaciones()`, `matchPlexWithoutApp()` |
| `src/plex/plex.service.ts` | Consulta recetas desde MySQL Plex | `getRecetasPlex(fechaDesde, fechaHasta)` |
| `src/misvalidaciones/misvalidaciones.service.ts` | Llama a la API externa de validación | `getRecetas(sucursal, cod_validacion)` |
| `src/auditoria/auditoria.service.ts` | Persiste en PostgreSQL con UPSERT | `bulkRecetaAudita(recetas)`, `getCajaSegunGlobal(idGlobal)` |
| `src/constante/obrasocial-api.ts` | Mapa de códigos obra social → servicio | — |

> No hay controllers con endpoints HTTP. La app es **solo cron**. Para ejecutar manualmente hay que reiniciar el proceso (el `onModuleInit` dispara la primera ejecución al arrancar).

---

## 14. Variables de Entorno

```
# MySQL Plex
DB_HOST=
DB_PORT=
DB_NAME=
DB_USERNAME=
DB_PASSWORD=
DB_CONNECTION_LIMIT=10

# PostgreSQL Auditoría (Railway)
PG_HOST=
PG_PORT=
PG_DATABASE=
PG_USERNAME=
PG_PASSWORD=
PG_SSL=true

# MisValidaciones
MIS_VALIDACIONES_ID=

# Credenciales por sucursal (una entrada por sucursal configurada)
# Sucursales: 1-12, 14-25, 32-37
USERNAME_1=
PASSWORD_1=
USERNAME_2=
PASSWORD_2=
# ... (mismo patrón para cada sucursal)

# Servidor
PORT=3000
```

---

*Documentación generada el 28/05/2026.*
