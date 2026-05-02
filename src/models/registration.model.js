import { DataTypes, Model } from "sequelize"
import { sequelize } from "../config/sequelize.js"
import { Campaign } from "./campaign.model.js"
import { User } from "./user.model.js"

export class Registration extends Model {}

Registration.init(
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
    userId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      field: "utilizador_id"
    },
    role: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      field: "funcao"
    },
    status: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      field: "estado"
    },
    attendance: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: "presenca"
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
    modelName: "registration",
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
        fields: ["campaignId", "userId"]
      }
    ]
  }
)

Registration.belongsTo(Campaign, {
  foreignKey: "campaignId",
  as: "campaign"
})
Registration.belongsTo(User, {
  foreignKey: "userId",
  as: "user"
})
Campaign.hasMany(Registration, {
  foreignKey: "campaignId",
  as: "registrations"
})
User.hasMany(Registration, {
  foreignKey: "userId",
  as: "registrations"
})

export default Registration
