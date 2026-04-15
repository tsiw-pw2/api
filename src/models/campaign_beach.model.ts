import { DataTypes, Model, type Optional } from "sequelize"
import { sequelize } from "../config/sequelize.js"

export type CampaignBeachAttributes = {
  id: string
  campaignId: string
  beachId: string
  createdAt: Date
  deletedAt: Date | null
}

export type CampaignBeachCreationAttributes = Optional<
  CampaignBeachAttributes,
  "id" | "createdAt" | "deletedAt"
>

export class CampaignBeach extends Model<
  CampaignBeachAttributes,
  CampaignBeachCreationAttributes
> {
  declare id: string
  declare campaignId: string
  declare beachId: string
  declare createdAt: Date
  declare deletedAt: Date | null
}

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
        unique: true,
        fields: ["campaignId", "beachId"]
      }
    ]
  }
)

export default CampaignBeach
