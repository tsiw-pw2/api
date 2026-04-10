const { asyncHandler } = require("../../../utils/async-handler")
const { softDeleteComment } = require("../services/comentario.service")

const deleteComment = asyncHandler(async (req, res) => {
    await softDeleteComment(req.params.id, req.user.id)
    res.status(204).end()
})

module.exports = { deleteComment }
