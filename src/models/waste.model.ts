import { DataTypes, Model, type Optional } from "sequelize"
import { sequelize } from "../config/sequelize.js"
import { WasteType } from "./waste_type.model.js"

export type WasteAttributes = {
  id: string
  wasteTypeId: string
  name: string
  averageWeightGrams: number | null
  createdAt: Date
  updatedAt: Date | null
  deletedAt: Date | null
}

export type WasteCreationAttributes = Optional<
  WasteAttributes,
  | "id"
  | "averageWeightGrams"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
>

export class Waste extends Model<WasteAttributes, WasteCreationAttributes> {
  declare id: string
  declare wasteTypeId: string
  declare name: string
  declare averageWeightGrams: number | null
  declare createdAt: Date
  declare updatedAt: Date | null
  declare deletedAt: Date | null
}

Waste.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    wasteTypeId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      field: "tipo_residuo_id"
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: "nome"
    },
    averageWeightGrams: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "peso_medio_gramas"
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
    modelName: "waste",
    tableName: "residuo",
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    underscored: true
  }
)

Waste.belongsTo(WasteType, {
  foreignKey: "wasteTypeId",
  as: "wasteType"
})
WasteType.hasMany(Waste, {
  foreignKey: "wasteTypeId",
  as: "wastes"
})

export default Waste
