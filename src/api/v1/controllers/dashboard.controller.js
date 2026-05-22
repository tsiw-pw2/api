import * as dashboardService from "../services/dashboard.service.js"

export async function getOverview(req, res, next) {
  try {
    const data = await dashboardService.buildDashboardOverview()
    res.json({ success: true, data })
  } catch (e) {
    next(e)
  }
}
