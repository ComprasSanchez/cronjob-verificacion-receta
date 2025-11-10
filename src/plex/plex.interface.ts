export interface RecetaPlex {
    IDComprobante: number;
    IDReceta: number;
    idGlobal: number;
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
    Comprobante: string;
    Operador: string;
}
