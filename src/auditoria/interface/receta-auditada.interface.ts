export interface IRecetaAuditado {
    /** ID del comprobante asociado a la receta en el sistema Plex */
    idComprobante: number;

    /** Número de comprobante en formato legible (ej: "A-0001-00001-00012345") */
    comprobante: string;

    /** ID de la receta en el sistema Plex */
    idReceta: number;

    /** ID de la caja asociada a la receta */
    idCaja: number | null;

    /** ID de la obra social en el sistema Plex */
    idObSocPlex: number;

    descripcionSucursal: string;

    /** Fecha de emisión de la receta */
    fechaEmision: Date;

    /** Fecha de prescripción de la receta */
    fechaPrescipcion: Date;

    fechaDispensacion: Date;

    /** Código de autorización de la receta */
    codAutorizacion: string | null;

    /** Total de la receta */
    totalReceta: number;

    /** Total ACOS (Aportes de la Obra Social) de la receta */
    totalACOS: number;

    /** Operador que procesó la receta */
    operador: string;

    /** Indica si la receta ha sido auditada */
    auditada: boolean;

    irregular: boolean;
}
