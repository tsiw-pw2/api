import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/sequelize.js";
import { Campanha } from "./campanha.model.js";
import { Utilizador } from "./utilizador.model.js";
export class Comentario extends Model {
}
Comentario.init({
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
    comentario: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    is_visible: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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
    modelName: "comentario",
    tableName: "comentario",
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    underscored: true
});
Comentario.belongsTo(Campanha, {
    foreignKey: "campanha_id",
    as: "campanha"
});
Comentario.belongsTo(Utilizador, {
    foreignKey: "utilizador_id",
    as: "utilizador"
});
Campanha.hasMany(Comentario, {
    foreignKey: "campanha_id",
    as: "comentarios"
});
Utilizador.hasMany(Comentario, {
    foreignKey: "utilizador_id",
    as: "comentarios"
});
export default Comentario;
