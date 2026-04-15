import { DataTypes, Model, type Optional } from "sequelize"
import { sequelize } from "../config/sequelize.js"

export type UserAttributes = {
  id: string
  name: string
  email: string
  passwordHash: string
  birthDate: string | null
  phone: string | null
  isAdmin: boolean
  isOrganizer: boolean
  isBlocked: boolean
  blockedReason: string | null
  blockedAt: Date | null
  createdAt: Date
  updatedAt: Date | null
}

export type UserCreationAttributes = Optional<
  UserAttributes,
  | "id"
  | "birthDate"
  | "phone"
  | "blockedReason"
  | "blockedAt"
  | "createdAt"
  | "updatedAt"
>

export class User extends Model<UserAttributes, UserCreationAttributes> {
  declare id: string
  declare name: string
  declare email: string
  declare passwordHash: string
  declare birthDate: string | null
  declare phone: string | null
  declare isAdmin: boolean
  declare isOrganizer: boolean
  declare isBlocked: boolean
  declare blockedReason: string | null
  declare blockedAt: Date | null
  declare createdAt: Date
  declare updatedAt: Date | null
}

User.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "nome"
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "palavra_passe"
    },
    birthDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "data_nascimento"
    },
    phone: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: "telefone"
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_admin"
    },
    isOrganizer: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_organizer"
    },
    isBlocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_blocked"
    },
    blockedReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "blocked_reason"
    },
    blockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "blocked_at"
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
    }
  },
  {
    sequelize,
    modelName: "user",
    tableName: "utilizador",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true
  }
)

export default User
