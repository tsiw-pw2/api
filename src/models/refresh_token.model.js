import { DataTypes, Model } from "sequelize"
import { sequelize } from "../config/sequelize.js"
import { User } from "./user.model.js"

export class RefreshToken extends Model {}

RefreshToken.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    userId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      field: "utilizador_id"
    },
    tokenHash: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
      field: "token_hash"
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expires_at"
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "revoked_at"
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at"
    }
  },
  {
    sequelize,
    modelName: "refresh_token",
    tableName: "refresh_token",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    underscored: true
  }
)

User.hasMany(RefreshToken, {
  foreignKey: "userId",
  as: "refreshTokens"
})

RefreshToken.belongsTo(User, {
  foreignKey: "userId",
  as: "user"
})

export default RefreshToken
