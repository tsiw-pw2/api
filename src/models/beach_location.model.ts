import { DataTypes, Model, type Optional } from "sequelize"
import { sequelize } from "../config/sequelize.js"

export type BeachLocationAttributes = {
  id: string
  district: string
  municipality: string
  parish: string
  nutsCode: string
  createdAt: Date
  updatedAt: Date | null
  deletedAt: Date | null
}

export type BeachLocationCreationAttributes = Optional<
  BeachLocationAttributes,
  "id" | "createdAt" | "updatedAt" | "deletedAt"
>

export class BeachLocation extends Model<
  BeachLocationAttributes,
  BeachLocationCreationAttributes
> {
  declare id: string
  declare district: string
  declare municipality: string
  declare parish: string
  declare nutsCode: string
  declare createdAt: Date
  declare updatedAt: Date | null
  declare deletedAt: Date | null
}

BeachLocation.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    district: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "distrito"
    },
    municipality: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "concelho"
    },
    parish: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "freguesia"
    },
    nutsCode: {
      type: DataTypes.STRING(5),
      allowNull: false,
      field: "codigo_nuts"
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
    modelName: "beach_location",
    tableName: "localizacao_praia",
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    underscored: true
  }
)

export default BeachLocation
