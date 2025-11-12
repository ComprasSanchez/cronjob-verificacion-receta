import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Entidad que representa una receta auditada en el sistema.
 * Almacena la información de recetas que han sido validadas y auditadas
 * mediante el proceso de verificación con el sistema Plex y MisValidaciones.
 */
@Entity('receta-auditado')
@Unique(['idReceta'])
export class RecetaAuditado {
    /**
     * Identificador único autogenerado de la receta auditada.
     */
    @PrimaryGeneratedColumn()
    id: number;

    /**
     * ID del comprobante asociado a la receta en el sistema Plex.
     * Relaciona la receta con la factura/comprobante correspondiente.
     */
    @Column({ name: 'id_comprobante', type: 'int' })
    idComprobante: number;

    /**
     * Número de comprobante en formato legible (ej: "A-0001-00001-00012345").
     * Representa el identificador del comprobante de forma concatenada.
     */
    @Column({ name: 'comprobante', type: 'varchar' })
    comprobante: string;

    /**
     * ID de la receta en el sistema Plex.
     * Identificador único de la receta en la base de datos Plex.
     */
    @Column({ name: 'id_receta', type: 'int' })
    idReceta: number;

    /**
     * ID de la caja asociada a la receta.
     * Nota: Futura Foreign Key a Caja. Actualmente se guarda con IDGLOBAL.
     */
    @Column({ name: 'id_caja', type: 'int' })
    idCaja: number;

    /**
     * ID de la obra social en el sistema Plex.
     * Identifica la obra social a la que pertenece el afiliado de la receta.
     */
    @Column({ name: 'id_ob_soc_plex', type: 'int' })
    idObSocPlex: number;

    /**
     * Fecha de emisión de la receta.
     * Fecha en la que se emitió la receta médica.
     */
    @Column({ name: 'fecha_emision', type: 'date' })
    fechaEmision: Date;

    /**
     * Fecha de prescripción de la receta.
     * Fecha en la que el médico prescribió la receta.
     */
    @Column({ name: 'fecha_prescripcion', type: 'date' })
    fechaPrescipcion: Date;

    /**
     * Código de autorización de la receta.
     * Código que autoriza el procesamiento de la receta por parte de la obra social.
     */
    @Column({ name: 'codigo_autorizacion', type: 'varchar', nullable: true })
    codAutorizacion: string | null;

    /**
     * Total de la receta.
     * Monto total de la receta en valor decimal.
     */
    @Column({ name: 'total_receta', type: 'decimal' })
    totalReceta: number;

    /**
     * Total ACOS (Aportes de la Obra Social) de la receta.
     * Monto correspondiente a los aportes de la obra social.
     * Precision: 15 dígitos, Scale: 2 decimales. Valor por defecto: 0.
     */
    @Column({ name: 'total_acos', type: 'decimal', precision: 15, scale: 2, default: 0 })
    totalACOS: number;

    /**
     * Operador que procesó la receta.
     * Nombre o identificador del operador que realizó la transacción.
     */
    @Column({ name: 'operador', type: 'varchar' })
    operador: string;

    /**
     * Indica si la receta ha sido auditada.
     * Flag booleano que determina si el proceso de auditoría fue completado.
     */
    @Column({ name: 'auditado', type: 'boolean' })
    auditada: boolean;

    @Column({ name: 'irregular', type: 'boolean' })
    irregular: boolean;
}
