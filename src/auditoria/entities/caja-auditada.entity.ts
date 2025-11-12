import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('caja-auditada')
export class CajaAuditada {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'id_global', type: 'int' }) // multiples cajas con mismo idGlobal pero diferente sucursal
    idGlobal: number;

    @Column({ type: 'int' })
    sucursal: number;

    @Column({ type: 'text', nullable: true })
    observacion: string;

    @Column({ name: 'fecha_apertura', type: 'timestamp', nullable: true })
    fechaApertura: Date;

    @Column({ name: 'fecha_cierre', type: 'timestamp', nullable: true })
    fechaCierre: Date;

    @Column({ name: 'operador', type: 'varchar', length: 100, nullable: true })
    operador: string;

    @Column({ name: 'auditado_por', type: 'varchar', length: 200, nullable: true })
    auditadoPor: string;

    @CreateDateColumn({ name: 'dia_auditado' })
    diaAuditado: Date;

    @UpdateDateColumn({ name: 'dia_auditado_cierre', nullable: true })
    diaAuditadoCierre: Date;
}
