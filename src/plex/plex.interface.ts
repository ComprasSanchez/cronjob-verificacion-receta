export interface RecetaPlex {
    IDComprobante: number;
    IDReceta: number;
    IdRecetaGlobal: string;
    IDGlobal: number | null;
    idGlobal: number | null;
    RefIDGlobal: number | null;
    FechaApertura: Date | null;
    FechaCierre: Date | null;
    Sucursal: number;
    NumReceta: string;
    CodObSoc: number;
    Descripcio: string;
    AfilNumero: string;
    AfilNombre: string;
    FechaEmision: Date;
    FechaPrescripcion: Date;
    FechaDispensacion: Date;
    CodAutorizacion: string | null;
    MedMatricula: string;
    MedNombre: string;
    TotReceta: number;
    TotACOS: number;
    Presentada: string;
    Pendiente: string;
    Comprobante: Buffer;
    Operador: string;
    Tipo: string;
}
