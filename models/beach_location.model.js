import { DataTypes, Model } from "sequelize"
import { sequelize } from "./sequelize.js"

export class BeachLocation extends Model {}

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
