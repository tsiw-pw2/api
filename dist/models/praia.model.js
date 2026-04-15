import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/sequelize.js";
import { LocalizacaoPraia } from "./localizacao_praia.model.js";
import { Utilizador } from "./utilizador.model.js";
export class Praia extends Model {
}
Praia.init({
    id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4
    },
    localizacao_praia_id: {
        type: DataTypes.CHAR(36),
        allowNull: false
    },
    criado_por_utilizador_id: {
        type: DataTypes.CHAR(36),
        allowNull: false
    },
    nome: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    latitude: {
        type: DataTypes.DECIMAL(9, 6),
        allowNull: false
    },
    longitude: {
        type: DataTypes.DECIMAL(9, 6),
        allowNull: false
    },
    descricao: {
        type: DataTypes.TEXT,
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
    modelName: "praia",
    tableName: "praia",
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    underscored: true
});
Praia.belongsTo(LocalizacaoPraia, {
    foreignKey: "localizacao_praia_id",
    as: "localizacao"
});
LocalizacaoPraia.hasMany(Praia, {
    foreignKey: "localizacao_praia_id",
    as: "praias"
});
Praia.belongsTo(Utilizador, {
    foreignKey: "criado_por_utilizador_id",
    as: "criador"
});
Utilizador.hasMany(Praia, {
    foreignKey: "criado_por_utilizador_id",
    as: "praias_criadas"
});
export default Praia;
