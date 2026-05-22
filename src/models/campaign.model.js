import { DataTypes, Model } from "sequelize"
import { sequelize } from "../config/sequelize.js"
import { Beach } from "./beach.model.js"
import { CampaignBeach } from "./campaign_beach.model.js"
import { User } from "./user.model.js"

export class Campaign extends Model {}

Campaign.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "titulo"
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "descricao"
    },
    meetingLocation: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "local_encontro"
    },
    meetingTime: {
      type: DataTypes.TIME,
      allowNull: true,
      field: "hora_encontro"
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "data_inicio"
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "data_fim"
    },
    status: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "estado"
    },
    organizerId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      field: "organizador_id"
    },
    districtCode: {
      type: DataTypes.STRING(40),
      allowNull: false,
      field: "distrito_codigo"
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
    modelName: "campaign",
    tableName: "campanha",
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    underscored: true
  }
)

Campaign.belongsTo(User, {
  foreignKey: "organizerId",
  as: "organizer"
})
User.hasMany(Campaign, {
  foreignKey: "organizerId",
  as: "organizedCampaigns"
})

CampaignBeach.belongsTo(Campaign, {
  foreignKey: "campaignId",
  as: "campaign"
})
CampaignBeach.belongsTo(Beach, {
  foreignKey: "beachId",
  as: "beach"
})
Campaign.hasMany(CampaignBeach, {
  foreignKey: "campaignId",
  as: "campaignBeaches"
})
Beach.hasMany(CampaignBeach, {
  foreignKey: "beachId",
  as: "campaignBeaches"
})
Campaign.belongsToMany(Beach, {
  through: CampaignBeach,
  foreignKey: "campaignId",
  otherKey: "beachId",
  as: "beaches"
})
Beach.belongsToMany(Campaign, {
  through: CampaignBeach,
  foreignKey: "beachId",
  otherKey: "campaignId",
  as: "campaigns"
})

export default Campaign
