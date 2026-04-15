import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/sequelize.js";
export class CampanhaPraia extends Model {
}
CampanhaPraia.init({
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
    created_at: {
        type: DataTypes.DATE,
        allowNull: false
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    sequelize,
    modelName: "campanha_praia",
    tableName: "campanha_praia",
    timestamps: true,
    updatedAt: false,
    paranoid: true,
    createdAt: "created_at",
    deletedAt: "deleted_at",
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ["campanha_id", "praia_id"]
        }
    ]
});
export default CampanhaPraia;
