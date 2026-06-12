// Tabela residuo (eliminação lógica). Catálogo por organização; associa-se a TipoResiduo.
import { DataTypes, Model } from "sequelize"
import { sequelize } from "./sequelize.js"
import { Organization } from "./organization.model.js"
import { WasteType } from "./waste_type.model.js"

export class Waste extends Model {}

Waste.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    organizationId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      field: "organizacao_id"
    },
    wasteTypeId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      field: "tipo_residuo_id"
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "nome"
    },
    unit: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "unit",
      field: "unidade"
    },
    averageWeightGrams: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "peso_medio_gramas"
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "created_at"
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "updated_at"
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "deleted_at"
    }
  },
  {
    sequelize,
    modelName: "waste",
    tableName: "residuo",
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    underscored: true,
    indexes: [
      {
        unique: true,
        name: "uk_residuo_org_nome",
        fields: ["organizacao_id", "nome"]
      }
    ]
  }
)

Waste.belongsTo(Organization, {
  foreignKey: "organizationId",
  as: "organization"
})
Organization.hasMany(Waste, {
  foreignKey: "organizationId",
  as: "wastes"
})

Waste.belongsTo(WasteType, {
  foreignKey: "wasteTypeId",
  as: "wasteType"
})
WasteType.hasMany(Waste, {
  foreignKey: "wasteTypeId",
  as: "wastes"
})

export default Waste
