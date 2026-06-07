// Tabela comentario (eliminação lógica). Associa-se a Campanha e Utilizador; is_visible permite ocultar sem apagar.
import { DataTypes, Model } from "sequelize"
import { sequelize } from "./sequelize.js"
import { Campaign } from "./campaign.model.js"
import { User } from "./user.model.js"

export class Comment extends Model {}

Comment.init(
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
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "comentario"
    },
    // Permitir que admins ocultem comentários sem os apagar
    isVisible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_visible"
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
    modelName: "comment",
    tableName: "comentario",
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    underscored: true
  }
)

Comment.belongsTo(Campaign, {
  foreignKey: "campaignId",
  as: "campaign"
})
Comment.belongsTo(User, {
  foreignKey: "userId",
  as: "user"
})
Campaign.hasMany(Comment, {
  foreignKey: "campaignId",
  as: "comments"
})
User.hasMany(Comment, {
  foreignKey: "userId",
  as: "comments"
})

export default Comment
