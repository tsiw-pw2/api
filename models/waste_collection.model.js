// Tabela recolha_residuo (eliminação lógica). Associa-se a Campanha, Praia, Resíduo e Utilizador (registador).
import { DataTypes, Model } from "sequelize"
import { sequelize } from "./sequelize.js"
import { Beach } from "./beach.model.js"
import { Campaign } from "./campaign.model.js"
import { User } from "./user.model.js"
import { Waste } from "./waste.model.js"

export class WasteCollection extends Model {}

WasteCollection.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    campaignId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      field: "campanha_id"
    },
    beachId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      field: "praia_id"
    },
    wasteId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      field: "residuo_id"
    },
    recordedByUserId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      field: "registado_por_utilizador_id"
    },
    unitQuantity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: "quantidade_unidades"
    },
    actualWeightKg: {
      type: DataTypes.DECIMAL(8, 3),
      allowNull: true,
      field: "peso_real_kg"
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
    modelName: "waste_collection",
    tableName: "recolha_residuo",
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    underscored: true,
    indexes: [
      {
        name: "uk_recolha_unique",
        unique: true,
        fields: ["campanha_id", "praia_id", "residuo_id"]
      }
    ]
  }
)

WasteCollection.belongsTo(Campaign, {
  foreignKey: "campaignId",
  as: "campaign"
})
WasteCollection.belongsTo(Beach, {
  foreignKey: "beachId",
  as: "beach"
})
WasteCollection.belongsTo(Waste, {
  foreignKey: "wasteId",
  as: "waste"
})
WasteCollection.belongsTo(User, {
  foreignKey: "recordedByUserId",
  as: "recordedBy"
})
Campaign.hasMany(WasteCollection, {
  foreignKey: "campaignId",
  as: "wasteCollections"
})
Beach.hasMany(WasteCollection, {
  foreignKey: "beachId",
  as: "wasteCollections"
})
Waste.hasMany(WasteCollection, {
  foreignKey: "wasteId",
  as: "collections"
})
User.hasMany(WasteCollection, {
  foreignKey: "recordedByUserId",
  as: "recordedWasteCollections"
})

export default WasteCollection
