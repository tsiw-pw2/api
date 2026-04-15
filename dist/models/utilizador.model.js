import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/sequelize.js";
export class Utilizador extends Model {
}
Utilizador.init({
    id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4
    },
    nome: {
        type: DataTypes.STRING(150),
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    palavra_passe: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    data_nascimento: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    telefone: {
        type: DataTypes.STRING(32),
        allowNull: true
    },
    is_admin: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    is_organizer: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    is_blocked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    blocked_reason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    blocked_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    sequelize,
    modelName: "utilizador",
    tableName: "utilizador",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true
});
export const User = Utilizador;
export default Utilizador;
