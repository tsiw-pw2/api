import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/sequelize.js";
import { Campanha } from "./campanha.model.js";
import { Utilizador } from "./utilizador.model.js";
export class Inscricao extends Model {
}
Inscricao.init({
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
    utilizador_id: {
        type: DataTypes.CHAR(36),
        allowNull: false
    },
    funcao: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false
    },
    estado: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false
    },
    presenca: {
        type: DataTypes.BOOLEAN,
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
    modelName: "inscricao",
    tableName: "inscricao",
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ["campanha_id", "utilizador_id"]
        }
    ]
});
Inscricao.belongsTo(Campanha, {
    foreignKey: "campanha_id",
    as: "campanha"
});
Inscricao.belongsTo(Utilizador, {
    foreignKey: "utilizador_id",
    as: "utilizador"
});
Campanha.hasMany(Inscricao, {
    foreignKey: "campanha_id",
    as: "inscricoes"
});
Utilizador.hasMany(Inscricao, {
    foreignKey: "utilizador_id",
    as: "inscricoes"
});
export default Inscricao;
