import { Campanha } from "./campanha.model.js";
import { CampanhaPraia } from "./campanha_praia.model.js";
import { Comentario } from "./comentario.model.js";
import { Inscricao } from "./inscricao.model.js";
import { LocalizacaoPraia } from "./localizacao_praia.model.js";
import { Praia } from "./praia.model.js";
import { RecolhaResiduo } from "./recolha_residuo.model.js";
import { Residuo } from "./residuo.model.js";
import { TipoResiduo } from "./tipo_residuo.model.js";
import { Utilizador } from "./utilizador.model.js";
export function setupAssociations() {
    Praia.belongsTo(LocalizacaoPraia, {
        foreignKey: "localizacao_praia_id",
        as: "localizacao"
    });
    LocalizacaoPraia.hasMany(Praia, {
        foreignKey: "localizacao_praia_id",
        as: "praias"
    });
    Praia.belongsTo(Utilizador, {
        foreignKey: "criado_por_utilizador_id",
        as: "criador"
    });
    Utilizador.hasMany(Praia, {
        foreignKey: "criado_por_utilizador_id",
        as: "praias_criadas"
    });
    Campanha.belongsTo(Utilizador, {
        foreignKey: "organizador_id",
        as: "organizador"
    });
    Utilizador.hasMany(Campanha, {
        foreignKey: "organizador_id",
        as: "campanhas_organizadas"
    });
    Residuo.belongsTo(TipoResiduo, {
        foreignKey: "tipo_residuo_id",
        as: "tipo"
    });
    TipoResiduo.hasMany(Residuo, {
        foreignKey: "tipo_residuo_id",
        as: "residuos"
    });
    CampanhaPraia.belongsTo(Campanha, {
        foreignKey: "campanha_id",
        as: "campanha"
    });
    CampanhaPraia.belongsTo(Praia, {
        foreignKey: "praia_id",
        as: "praia"
    });
    Campanha.hasMany(CampanhaPraia, {
        foreignKey: "campanha_id",
        as: "campanha_praias"
    });
    Praia.hasMany(CampanhaPraia, {
        foreignKey: "praia_id",
        as: "campanha_praias"
    });
    Campanha.belongsToMany(Praia, {
        through: CampanhaPraia,
        foreignKey: "campanha_id",
        otherKey: "praia_id",
        as: "praias"
    });
    Praia.belongsToMany(Campanha, {
        through: CampanhaPraia,
        foreignKey: "praia_id",
        otherKey: "campanha_id",
        as: "campanhas"
    });
    Inscricao.belongsTo(Campanha, {
        foreignKey: "campanha_id",
        as: "campanha"
    });
    Inscricao.belongsTo(Utilizador, {
        foreignKey: "utilizador_id",
        as: "utilizador"
    });
    Campanha.hasMany(Inscricao, {
        foreignKey: "campanha_id",
        as: "inscricoes"
    });
    Utilizador.hasMany(Inscricao, {
        foreignKey: "utilizador_id",
        as: "inscricoes"
    });
    Comentario.belongsTo(Campanha, {
        foreignKey: "campanha_id",
        as: "campanha"
    });
    Comentario.belongsTo(Utilizador, {
        foreignKey: "utilizador_id",
        as: "utilizador"
    });
    Campanha.hasMany(Comentario, {
        foreignKey: "campanha_id",
        as: "comentarios"
    });
    Utilizador.hasMany(Comentario, {
        foreignKey: "utilizador_id",
        as: "comentarios"
    });
    RecolhaResiduo.belongsTo(Campanha, {
        foreignKey: "campanha_id",
        as: "campanha"
    });
    RecolhaResiduo.belongsTo(Praia, {
        foreignKey: "praia_id",
        as: "praia"
    });
    RecolhaResiduo.belongsTo(Residuo, {
        foreignKey: "residuo_id",
        as: "residuo"
    });
    RecolhaResiduo.belongsTo(Utilizador, {
        foreignKey: "registado_por_utilizador_id",
        as: "registado_por"
    });
    Campanha.hasMany(RecolhaResiduo, {
        foreignKey: "campanha_id",
        as: "recolhas_residuo"
    });
    Praia.hasMany(RecolhaResiduo, {
        foreignKey: "praia_id",
        as: "recolhas_residuo"
    });
    Residuo.hasMany(RecolhaResiduo, {
        foreignKey: "residuo_id",
        as: "recolhas"
    });
    Utilizador.hasMany(RecolhaResiduo, {
        foreignKey: "registado_por_utilizador_id",
        as: "recolhas_registadas"
    });
}
