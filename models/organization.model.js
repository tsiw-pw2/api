import { DataTypes, Model } from "sequelize"
import { sequelize } from "./sequelize.js"

export class Organization extends Model {}

Organization.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "nome"
    },
    contactEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "email_contacto"
    },
    municipality: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "concelho"
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
    modelName: "organization",
    tableName: "organizacao",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true
  }
)

export default Organization
