// Tabela tipo_residuo (eliminação lógica). Categorias do catálogo por organização; um tipo tem muitos resíduos.
import { DataTypes, Model } from "sequelize"
import { sequelize } from "./sequelize.js"
import { Organization } from "./organization.model.js"

export class WasteType extends Model {}

WasteType.init(
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "nome"
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
    modelName: "waste_type",
    tableName: "tipo_residuo",
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    underscored: true,
    indexes: [
      {
        unique: true,
        name: "uk_tipo_residuo_org_nome",
        fields: ["organizacao_id", "nome"]
      }
    ]
  }
)

WasteType.belongsTo(Organization, {
  foreignKey: "organizationId",
  as: "organization"
})
Organization.hasMany(WasteType, {
  foreignKey: "organizationId",
  as: "wasteTypes"
})

export default WasteType
