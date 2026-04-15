import { DataTypes, Model, type Optional } from "sequelize"
import { sequelize } from "../config/sequelize.js"
import { BeachLocation } from "./beach_location.model.js"
import { User } from "./user.model.js"

export type BeachAttributes = {
  id: string
  beachLocationId: string
  createdByUserId: string
  name: string
  latitude: string
  longitude: string
  description: string | null
  createdAt: Date
  updatedAt: Date | null
  deletedAt: Date | null
}

export type BeachCreationAttributes = Optional<
  BeachAttributes,
  | "id"
  | "description"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
>

export class Beach extends Model<BeachAttributes, BeachCreationAttributes> {
  declare id: string
  declare beachLocationId: string
  declare createdByUserId: string
  declare name: string
  declare latitude: string
  declare longitude: string
  declare description: string | null
  declare createdAt: Date
  declare updatedAt: Date | null
  declare deletedAt: Date | null
}

Beach.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    beachLocationId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      field: "localizacao_praia_id"
    },
    createdByUserId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      field: "criado_por_utilizador_id"
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "nome"
    },
    latitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: false
    },
    longitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "descricao"
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
    modelName: "beach",
    tableName: "praia",
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    underscored: true
  }
)

Beach.belongsTo(BeachLocation, {
  foreignKey: "beachLocationId",
  as: "beachLocation"
})
BeachLocation.hasMany(Beach, {
  foreignKey: "beachLocationId",
  as: "beaches"
})
Beach.belongsTo(User, {
  foreignKey: "createdByUserId",
  as: "creator"
})
User.hasMany(Beach, {
  foreignKey: "createdByUserId",
  as: "createdBeaches"
})

export default Beach
