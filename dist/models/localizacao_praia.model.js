import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/sequelize.js";
export class LocalizacaoPraia extends Model {
}
LocalizacaoPraia.init({
    id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4
    },
    distrito: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    concelho: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    freguesia: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    codigo_nuts: {
        type: DataTypes.STRING(5),
        allowNull: false
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
    modelName: "localizacao_praia",
    tableName: "localizacao_praia",
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    underscored: true
});
export default LocalizacaoPraia;
