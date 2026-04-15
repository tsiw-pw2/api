import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/sequelize.js";
import { Campanha } from "./campanha.model.js";
import { Praia } from "./praia.model.js";
import { Residuo } from "./residuo.model.js";
import { Utilizador } from "./utilizador.model.js";
export class RecolhaResiduo extends Model {
}
RecolhaResiduo.init({
    id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4
    },
    campanha_id: {
        type: DataTypes.CHAR(36),
        allowNull: false
    },
    praia_id: {
        type: DataTypes.CHAR(36),
        allowNull: false
    },
    residuo_id: {
        type: DataTypes.CHAR(36),
        allowNull: false
    },
    registado_por_utilizador_id: {
        type: DataTypes.CHAR(36),
        allowNull: false
    },
    quantidade_unidades: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    peso_real_kg: {
        type: DataTypes.DECIMAL(8, 3),
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
    modelName: "recolha_residuo",
    tableName: "recolha_residuo",
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ["campanha_id", "praia_id", "residuo_id"]
        }
    ]
});
RecolhaResiduo.belongsTo(Campanha, {
    foreignKey: "campanha_id",
    as: "campanha"
});
RecolhaResiduo.belongsTo(Praia, {
    foreignKey: "praia_id",
    as: "praia"
});
RecolhaResiduo.belongsTo(Residuo, {
    foreignKey: "residuo_id",
    as: "residuo"
});
RecolhaResiduo.belongsTo(Utilizador, {
    foreignKey: "registado_por_utilizador_id",
    as: "registado_por"
});
Campanha.hasMany(RecolhaResiduo, {
    foreignKey: "campanha_id",
    as: "recolhas_residuo"
});
Praia.hasMany(RecolhaResiduo, {
    foreignKey: "praia_id",
    as: "recolhas_residuo"
});
Residuo.hasMany(RecolhaResiduo, {
    foreignKey: "residuo_id",
    as: "recolhas"
});
Utilizador.hasMany(RecolhaResiduo, {
    foreignKey: "registado_por_utilizador_id",
    as: "recolhas_registadas"
});
export default RecolhaResiduo;
