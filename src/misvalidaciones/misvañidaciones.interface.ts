export interface RecetaResponse {
    tipo_matricula: string;
    nrorecetario: string;
    afiliado_numero: string;
    matricula: number;
    plan_id: number;
    cuf: string;
    plan_grupo: string | null;
    afiliado_nombres: string;
    cod_validacion: number;
    status: string;
    medico_nombres: string;
    convenio: string;
    plan: string;
    cod_operacion: string;
    data: string;
    centrocosto: string;
    convenio_id: number;
    gln: string;
    items: RecetaItem[];
    afiliado_documento: number;
    centrocosto_id: number;
    fecha_receta: string; // formato: "YYYY-MM-DD"
    token_digital: string;
}

export interface RecetaItem {
    status: string;
    plan_id: number;
    cantidad: number;
    nro_item: number;
    laboratorio: string;
    error_item: string;
    precio_total: string;
    cod_trazabilidad: string;
    troquel: number;
    precio_unitario: string;
    cargo_afiliado: string;
    importe_cobertura: string;
    nombre: string;
    porc_cobertura: string;
    codbarras: string;
    presentacion: string;
    alfabeta: number;
    plan: string;
}
