const { DataTypes } = require("sequelize")
const { sequelize } = require("../../config/sequelize")

const Utilizador = sequelize.define(
    "utilizador",
    {
        id: { type: DataTypes.CHAR(36), primaryKey: true },
        nome: { type: DataTypes.STRING(150), allowNull: false },
        email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
        palavra_passe: { type: DataTypes.STRING(255), allowNull: false },
        data_nascimento: DataTypes.DATEONLY,
        telefone: DataTypes.STRING(32),
        is_admin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        is_organizer: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        is_blocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        blocked_reason: DataTypes.TEXT,
        blocked_at: DataTypes.DATE,
        token_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    },
    {
        tableName: "utilizador",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
)

const RefreshSessao = sequelize.define(
    "refresh_sessao",
    {
        id: { type: DataTypes.CHAR(36), primaryKey: true },
        utilizador_id: { type: DataTypes.CHAR(36), allowNull: false },
        token_hash: { type: DataTypes.STRING(255), allowNull: false },
        expires_at: { type: DataTypes.DATE, allowNull: false },
    },
    {
        tableName: "refresh_sessao",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: false,
    },
)

const LocalizacaoPraia = sequelize.define(
    "localizacao_praia",
    {
        id: { type: DataTypes.CHAR(36), primaryKey: true },
        distrito: { type: DataTypes.STRING(255), allowNull: false },
        concelho: { type: DataTypes.STRING(255), allowNull: false },
        freguesia: { type: DataTypes.STRING(255), allowNull: false },
        codigo_nuts: { type: DataTypes.STRING(5), allowNull: false },
    },
    {
        tableName: "localizacao_praia",
        paranoid: true,
        deletedAt: "deleted_at",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
)

const Praia = sequelize.define(
    "praia",
    {
        id: { type: DataTypes.CHAR(36), primaryKey: true },
        localizacao_praia_id: { type: DataTypes.CHAR(36), allowNull: false },
        criado_por_utilizador_id: { type: DataTypes.CHAR(36), allowNull: false },
        nome: { type: DataTypes.STRING(255), allowNull: false },
        latitude: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
        longitude: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
        descricao: DataTypes.TEXT,
    },
    {
        tableName: "praia",
        paranoid: true,
        deletedAt: "deleted_at",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
)

const Campanha = sequelize.define(
    "campanha",
    {
        id: { type: DataTypes.CHAR(36), primaryKey: true },
        titulo: { type: DataTypes.STRING(255), allowNull: false },
        descricao: DataTypes.TEXT,
        local_encontro: { type: DataTypes.STRING(255), allowNull: false },
        hora_encontro: DataTypes.TIME,
        data_inicio: { type: DataTypes.DATEONLY, allowNull: false },
        data_fim: { type: DataTypes.DATEONLY, allowNull: false },
        estado: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        organizador_id: { type: DataTypes.CHAR(36), allowNull: false },
    },
    {
        tableName: "campanha",
        paranoid: true,
        deletedAt: "deleted_at",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
)

const TipoResiduo = sequelize.define(
    "tipo_residuo",
    {
        id: { type: DataTypes.CHAR(36), primaryKey: true },
        nome: { type: DataTypes.STRING(255), allowNull: false },
    },
    {
        tableName: "tipo_residuo",
        paranoid: true,
        deletedAt: "deleted_at",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
)

const Residuo = sequelize.define(
    "residuo",
    {
        id: { type: DataTypes.CHAR(36), primaryKey: true },
        tipo_residuo_id: { type: DataTypes.CHAR(36), allowNull: false },
        nome: { type: DataTypes.STRING(255), allowNull: false, unique: true },
        peso_medio_gramas: DataTypes.INTEGER.UNSIGNED,
    },
    {
        tableName: "residuo",
        paranoid: true,
        deletedAt: "deleted_at",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
)

const CampanhaPraia = sequelize.define(
    "campanha_praia",
    {
        id: { type: DataTypes.CHAR(36), primaryKey: true },
        campanha_id: { type: DataTypes.CHAR(36), allowNull: false },
        praia_id: { type: DataTypes.CHAR(36), allowNull: false },
    },
    {
        tableName: "campanha_praia",
        paranoid: true,
        deletedAt: "deleted_at",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: false,
    },
)

const Inscricao = sequelize.define(
    "inscricao",
    {
        id: { type: DataTypes.CHAR(36), primaryKey: true },
        campanha_id: { type: DataTypes.CHAR(36), allowNull: false },
        utilizador_id: { type: DataTypes.CHAR(36), allowNull: false },
        funcao: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
        estado: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
        presenca: DataTypes.BOOLEAN,
    },
    {
        tableName: "inscricao",
        paranoid: true,
        deletedAt: "deleted_at",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
)

const Comentario = sequelize.define(
    "comentario",
    {
        id: { type: DataTypes.CHAR(36), primaryKey: true },
        campanha_id: { type: DataTypes.CHAR(36), allowNull: false },
        utilizador_id: { type: DataTypes.CHAR(36), allowNull: false },
        comentario: { type: DataTypes.TEXT, allowNull: false },
        is_visible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
        tableName: "comentario",
        paranoid: true,
        deletedAt: "deleted_at",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
)

const RecolhaResiduo = sequelize.define(
    "recolha_residuo",
    {
        id: { type: DataTypes.CHAR(36), primaryKey: true },
        campanha_id: { type: DataTypes.CHAR(36), allowNull: false },
        praia_id: { type: DataTypes.CHAR(36), allowNull: false },
        residuo_id: { type: DataTypes.CHAR(36), allowNull: false },
        registado_por_utilizador_id: { type: DataTypes.CHAR(36), allowNull: false },
        quantidade_unidades: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        peso_real_kg: DataTypes.DECIMAL(8, 3),
    },
    {
        tableName: "recolha_residuo",
        paranoid: true,
        deletedAt: "deleted_at",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
)

Utilizador.hasMany(RefreshSessao, { foreignKey: "utilizador_id", as: "refresh_sessoes" })
RefreshSessao.belongsTo(Utilizador, { foreignKey: "utilizador_id", as: "utilizador" })

LocalizacaoPraia.hasMany(Praia, { foreignKey: "localizacao_praia_id", as: "praias" })
Praia.belongsTo(LocalizacaoPraia, { foreignKey: "localizacao_praia_id", as: "localizacao" })
Utilizador.hasMany(Praia, { foreignKey: "criado_por_utilizador_id", as: "praias_criadas" })
Praia.belongsTo(Utilizador, { foreignKey: "criado_por_utilizador_id", as: "criador" })

Utilizador.hasMany(Campanha, { foreignKey: "organizador_id", as: "campanhas_organizadas" })
Campanha.belongsTo(Utilizador, { foreignKey: "organizador_id", as: "organizador" })

TipoResiduo.hasMany(Residuo, { foreignKey: "tipo_residuo_id", as: "residuos" })
Residuo.belongsTo(TipoResiduo, { foreignKey: "tipo_residuo_id", as: "tipo" })

Campanha.belongsToMany(Praia, {
    through: CampanhaPraia,
    foreignKey: "campanha_id",
    otherKey: "praia_id",
    as: "praias",
})
Praia.belongsToMany(Campanha, {
    through: CampanhaPraia,
    foreignKey: "praia_id",
    otherKey: "campanha_id",
    as: "campanhas",
})

Campanha.hasMany(CampanhaPraia, { foreignKey: "campanha_id", as: "campanha_praia_links" })
CampanhaPraia.belongsTo(Campanha, { foreignKey: "campanha_id", as: "campanha" })
CampanhaPraia.belongsTo(Praia, { foreignKey: "praia_id", as: "praia" })

Campanha.hasMany(Inscricao, { foreignKey: "campanha_id", as: "inscricoes" })
Inscricao.belongsTo(Campanha, { foreignKey: "campanha_id", as: "campanha" })
Inscricao.belongsTo(Utilizador, { foreignKey: "utilizador_id", as: "utilizador" })

Campanha.hasMany(Comentario, { foreignKey: "campanha_id", as: "comentarios" })
Comentario.belongsTo(Campanha, { foreignKey: "campanha_id", as: "campanha" })
Comentario.belongsTo(Utilizador, { foreignKey: "utilizador_id", as: "autor" })

Campanha.hasMany(RecolhaResiduo, { foreignKey: "campanha_id", as: "recolhas" })
RecolhaResiduo.belongsTo(Campanha, { foreignKey: "campanha_id", as: "campanha" })
RecolhaResiduo.belongsTo(Praia, { foreignKey: "praia_id", as: "praia" })
RecolhaResiduo.belongsTo(Residuo, { foreignKey: "residuo_id", as: "residuo" })
RecolhaResiduo.belongsTo(Utilizador, { foreignKey: "registado_por_utilizador_id", as: "registado_por" })

module.exports = {
    sequelize,
    Utilizador,
    RefreshSessao,
    LocalizacaoPraia,
    Praia,
    Campanha,
    TipoResiduo,
    Residuo,
    CampanhaPraia,
    Inscricao,
    Comentario,
    RecolhaResiduo,
}
