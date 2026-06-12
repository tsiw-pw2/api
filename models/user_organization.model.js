import { DataTypes, Model } from "sequelize"
import { sequelize } from "./sequelize.js"
import { Organization } from "./organization.model.js"
import { User } from "./user.model.js"

export class UserOrganization extends Model {}

UserOrganization.init(
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
    organizationId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      field: "organizacao_id"
    },
    isOrgAdmin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_admin_org"
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "created_at"
    }
  },
  {
    sequelize,
    modelName: "userOrganization",
    tableName: "utilizador_organizacao",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    underscored: true
  }
)

UserOrganization.belongsTo(User, { foreignKey: "userId", as: "user" })
UserOrganization.belongsTo(Organization, { foreignKey: "organizationId", as: "organization" })
User.belongsToMany(Organization, {
  through: UserOrganization,
  foreignKey: "userId",
  otherKey: "organizationId",
  as: "organizations"
})
Organization.belongsToMany(User, {
  through: UserOrganization,
  foreignKey: "organizationId",
  otherKey: "userId",
  as: "members"
})

export default UserOrganization
