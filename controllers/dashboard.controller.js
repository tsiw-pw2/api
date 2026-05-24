import { forwardControllerError } from "../utils/error.utils.js"
import { buildDashboardOverview } from "./campaigns.controller.js"
import { CAMPAIGNS_BASE, DASHBOARD_BASE } from "../utils/hateoas.utils.js"

function buildDashboardResource(overview) {
  const links = {
    self: { href: DASHBOARD_BASE, method: "GET" },
    campaigns: { href: CAMPAIGNS_BASE, method: "GET" }
  }
  if (overview.nextCampaignId) {
    links.nextCampaign = {
      href: `${CAMPAIGNS_BASE}/${overview.nextCampaignId}`,
      method: "GET"
    }
  }
  return {
    id: "overview",
    ...overview,
    links
  }
}

export const getDashboard = async (req, res, next) => {
  try {
    const overview = await buildDashboardOverview()
    res.json(buildDashboardResource(overview))
  } catch (error) {
    forwardControllerError(error, next, "Error fetching dashboard")
  }
}
