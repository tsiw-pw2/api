import { DataTypes, Model } from "sequelize"
import { sequelize } from "./sequelize.js"

// Trato refresh como sessão stateful: persisto só o hash, nunca o token em claro
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
      field: "created_at"
    }
  },
  {
    sequelize,
    modelName: "refreshToken",
    tableName: "refresh_token",
    timestamps: false,
    underscored: true
  }
)

export default RefreshToken
