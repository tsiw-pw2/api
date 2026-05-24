import { DataTypes, Model } from "sequelize"
import { sequelize } from "./sequelize.js"

export class CampaignBeach extends Model {}

CampaignBeach.init(
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
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "created_at"
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "deleted_at"
    }
  },
  {
    sequelize,
    modelName: "campaign_beach",
    tableName: "campanha_praia",
    timestamps: true,
    updatedAt: false,
    paranoid: true,
    createdAt: "created_at",
    deletedAt: "deleted_at",
    underscored: true,
    indexes: [
      {
        name: "uk_campanha_praia",
        unique: true,
        fields: ["campanha_id", "praia_id"]
      }
    ]
  }
)

export default CampaignBeach
