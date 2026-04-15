import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/sequelize.js";
import { TipoResiduo } from "./tipo_residuo.model.js";
export class Residuo extends Model {
}
Residuo.init({
    id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4
    },
    tipo_residuo_id: {
        type: DataTypes.CHAR(36),
        allowNull: false
    },
    nome: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    peso_medio_gramas: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    sequelize,
    modelName: "residuo",
    tableName: "residuo",
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    underscored: true
});
Residuo.belongsTo(TipoResiduo, {
    foreignKey: "tipo_residuo_id",
    as: "tipo"
});
TipoResiduo.hasMany(Residuo, {
    foreignKey: "tipo_residuo_id",
    as: "residuos"
});
export default Residuo;
