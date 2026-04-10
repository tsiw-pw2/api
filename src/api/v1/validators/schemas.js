const { z } = require("zod")
const { ApiError } = require("../../../utils/api-error")

const uuid = z.string().uuid()

const registerUser = z.object({
    nome: z.string().trim().min(1, "O nome é obrigatório."),
    email: z.string().trim().email("O email deve ser válido."),
    password: z.string().min(1, "A palavra-passe é obrigatória."),
    data_nascimento: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (AAAA-MM-DD)."),
    telefone: z.string().trim().optional().nullable(),
})

const login = z.object({
    email: z.string().trim().email("O email deve ser válido."),
    password: z.string().min(1, "A palavra-passe é obrigatória."),
})

const patchMe = z
    .object({
        nome: z.string().trim().min(1).optional(),
        telefone: z.string().trim().nullable().optional(),
        data_nascimento: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .nullable()
            .optional(),
        current_password: z.string().optional(),
        password: z.string().optional(),
    })
    .strict()

const campaignsQuery = z.object({
    estado: z.coerce.number().int().min(0).max(5).optional(),
    from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).optional(),
})

const createCampaign = z.object({
    titulo: z.string().trim().min(1, "O título é obrigatório."),
    local_encontro: z.string().trim().min(1, "O local de encontro é obrigatório."),
    data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data_inicio inválida."),
    data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data_fim inválida."),
    descricao: z.string().optional().nullable(),
    hora_encontro: z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/, "hora_encontro inválida.")
        .optional()
        .nullable(),
    estado: z.coerce.number().int().min(0).max(5).optional(),
})

const patchCampaign = z
    .object({
        titulo: z.string().trim().min(1).optional(),
        local_encontro: z.string().trim().min(1).optional(),
        data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        descricao: z.string().nullable().optional(),
        hora_encontro: z
            .string()
            .regex(/^\d{2}:\d{2}(:\d{2})?$/)
            .nullable()
            .optional(),
        estado: z.coerce.number().int().min(0).max(5).optional(),
    })
    .strict()

const putCampaignBeaches = z.object({
    beach_ids: z.array(uuid),
})

const upsertRecolha = z.object({
    residuo_id: uuid,
    quantidade_unidades: z.coerce.number().int().min(0),
    peso_real_kg: z.coerce.number().min(0).optional().nullable(),
})

const postRegistration = z
    .object({
        funcao: z.coerce.number().int().min(0).max(1).optional(),
        utilizador_id: uuid.optional(),
        estado: z.coerce.number().int().min(0).max(2).optional(),
        presenca: z.union([z.boolean(), z.null()]).optional(),
    })
    .strict()

const patchRegistration = z
    .object({
        estado: z.coerce.number().int().min(0).max(2).optional(),
        funcao: z.coerce.number().int().min(0).max(1).optional(),
        presenca: z.union([z.boolean(), z.null()]).optional(),
    })
    .strict()
    .refine((o) => o.estado !== undefined || o.funcao !== undefined || o.presenca !== undefined, {
        message: "Pelo menos um campo deve ser enviado.",
    })

const postComment = z.object({
    comentario: z.string().trim().min(1, "O comentário é obrigatório."),
})

const beachesQuery = z.object({
    distrito: z.string().trim().optional(),
    concelho: z.string().trim().optional(),
    nome: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).optional(),
})

const paginationOnly = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).optional(),
})

const wastesQuery = z.object({
    tipo_residuo_id: uuid.optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).optional(),
})

const postTipoResiduo = z.object({
    nome: z.string().trim().min(1, "O nome é obrigatório."),
})

const postResiduo = z.object({
    tipo_residuo_id: uuid,
    nome: z.string().trim().min(1, "O nome é obrigatório."),
    peso_medio_gramas: z.coerce.number().int().min(0).optional().nullable(),
})

const patchTipoResiduo = z
    .object({
        nome: z.string().trim().min(1).optional(),
        deleted_at: z.union([z.string(), z.null()]).optional(),
    })
    .strict()

const patchResiduo = z
    .object({
        nome: z.string().trim().min(1).optional(),
        tipo_residuo_id: uuid.optional(),
        peso_medio_gramas: z.coerce.number().int().min(0).nullable().optional(),
        deleted_at: z.union([z.string(), z.null()]).optional(),
    })
    .strict()

const adminDashboardQuery = z.object({
    period: z.enum(["30d", "90d", "year", "custom"]).optional(),
    from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
})

const adminUsersQuery = z.object({
    is_blocked: z.coerce.number().int().min(0).max(1).optional(),
    is_admin: z.coerce.number().int().min(0).max(1).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).optional(),
})

const blockUser = z.object({
    blocked_reason: z.string().trim().min(1, "O motivo é obrigatório."),
})

const postLocation = z.object({
    distrito: z.string().trim().min(1),
    concelho: z.string().trim().min(1),
    freguesia: z.string().trim().min(1),
    codigo_nuts: z
        .string()
        .trim()
        .length(5, "Formato inválido (ex.: 5 caracteres)."),
})

const postAdminBeach = z.object({
    localizacao_praia_id: uuid,
    nome: z.string().trim().min(1),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    descricao: z.string().nullable().optional(),
})

const patchAdminBeach = z
    .object({
        nome: z.string().trim().min(1).optional(),
        latitude: z.coerce.number().min(-90).max(90).optional(),
        longitude: z.coerce.number().min(-180).max(180).optional(),
        descricao: z.string().nullable().optional(),
        localizacao_praia_id: uuid.optional(),
        deleted_at: z.union([z.string(), z.null()]).optional(),
    })
    .strict()

const patchAdminComment = z.object({
    is_visible: z.coerce.number().int().min(0).max(1),
})

function parse(schema, data) {
    const r = schema.safeParse(data)
    if (!r.success) throw ApiError.fromZod(r.error)
    return r.data
}

module.exports = {
    registerUser,
    login,
    patchMe,
    campaignsQuery,
    createCampaign,
    patchCampaign,
    putCampaignBeaches,
    upsertRecolha,
    postRegistration,
    patchRegistration,
    postComment,
    beachesQuery,
    paginationOnly,
    wastesQuery,
    postTipoResiduo,
    postResiduo,
    patchTipoResiduo,
    patchResiduo,
    adminDashboardQuery,
    adminUsersQuery,
    blockUser,
    postLocation,
    postAdminBeach,
    patchAdminBeach,
    patchAdminComment,
    parse,
}
