import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/sequelize.js";
import { CampanhaPraia } from "./campanha_praia.model.js";
import { Praia } from "./praia.model.js";
import { Utilizador } from "./utilizador.model.js";
export class Campanha extends Model {
}
Campanha.init({
    id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4
    },
    titulo: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    descricao: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    local_encontro: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    hora_encontro: {
        type: DataTypes.TIME,
        allowNull: true
    },
    data_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    data_fim: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    estado: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0
    },
    organizador_id: {
        type: DataTypes.CHAR(36),
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
    modelName: "campanha",
    tableName: "campanha",
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    underscored: true
});
Campanha.belongsTo(Utilizador, {
    foreignKey: "organizador_id",
    as: "organizador"
});
Utilizador.hasMany(Campanha, {
    foreignKey: "organizador_id",
    as: "campanhas_organizadas"
});
CampanhaPraia.belongsTo(Campanha, {
    foreignKey: "campanha_id",
    as: "campanha"
});
CampanhaPraia.belongsTo(Praia, {
    foreignKey: "praia_id",
    as: "praia"
});
Campanha.hasMany(CampanhaPraia, {
    foreignKey: "campanha_id",
    as: "campanha_praias"
});
Praia.hasMany(CampanhaPraia, {
    foreignKey: "praia_id",
    as: "campanha_praias"
});
Campanha.belongsToMany(Praia, {
    through: CampanhaPraia,
    foreignKey: "campanha_id",
    otherKey: "praia_id",
    as: "praias"
});
Praia.belongsToMany(Campanha, {
    through: CampanhaPraia,
    foreignKey: "praia_id",
    otherKey: "campanha_id",
    as: "campanhas"
});
export default Campanha;
