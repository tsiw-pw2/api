import express from "express";
import cors from "cors";
import { rotasAuth } from "./routes/auth.routes.js";
import { Beach, BeachLocation, Campaign, Comment, Registration, User, Waste, WasteCollection } from "./models/index.js";
const app = express();
const corsOrigin = process.env.CLIENT_URL ?? "http://localhost:3000";
app.use(cors({
    origin: corsOrigin
}));
app.use(express.json());
function formatDatePt(dateIso) {
    const [y, m, d] = dateIso.split("-");
    if (!y || !m || !d)
        return dateIso;
    return `${d}/${m}/${y}`;
}
app.get("/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" } });
});
const API_PREFIX = "/api/v1";
app.use(API_PREFIX, rotasAuth);
app.get(`${API_PREFIX}/campaigns`, async (req, res) => {
    const includeDeleted = req.query.includeDeleted === "true";
    const campaigns = await Campaign.findAll({
        paranoid: !includeDeleted,
        order: [["startDate", "ASC"]],
        include: [
            {
                model: Beach,
                as: "beaches",
                through: { attributes: [] },
                include: [{ model: BeachLocation, as: "beachLocation" }]
            }
        ]
    });
    const rows = campaigns.map((c) => {
        const beaches = Array.isArray(c.beaches) ? c.beaches : [];
        const beachNames = beaches.map((b) => b?.name).filter(Boolean);
        const firstLocation = beaches[0]?.beachLocation;
        const municipality = firstLocation?.municipality ?? "—";
        return {
            id: c.id,
            title: c.title,
            municipality,
            beach: beachNames.length > 0 ? beachNames.join(", ") : "—",
            startDate: formatDatePt(c.startDate),
            endDate: formatDatePt(c.endDate)
        };
    });
    res.json(rows);
});
app.get(`${API_PREFIX}/campaigns/:campaignId`, async (req, res) => {
    const includeDeleted = req.query.includeDeleted === "true";
    const campaignId = req.params.campaignId;
    const campaign = await Campaign.findOne({
        where: { id: campaignId },
        paranoid: !includeDeleted,
        include: [
            { model: User, as: "organizer" },
            {
                model: Beach,
                as: "beaches",
                through: { attributes: [] },
                include: [{ model: BeachLocation, as: "beachLocation" }]
            },
            {
                model: Registration,
                as: "registrations",
                include: [{ model: User, as: "user" }]
            },
            {
                model: Comment,
                as: "comments",
                where: {
                    isVisible: true
                },
                required: false,
                include: [{ model: User, as: "user" }]
            },
            {
                model: WasteCollection,
                as: "wasteCollections",
                required: false,
                include: [
                    { model: Beach, as: "beach" },
                    { model: Waste, as: "waste" },
                    { model: User, as: "recordedBy" }
                ]
            }
        ]
    });
    if (!campaign) {
        res.status(404).json({ message: "Campanha não encontrada" });
        return;
    }
    const beaches = Array.isArray(campaign.beaches)
        ? (campaign.beaches ?? [])
        : [];
    const registrations = Array.isArray(campaign.registrations)
        ? (campaign.registrations ?? [])
        : [];
    const comments = Array.isArray(campaign.comments)
        ? (campaign.comments ?? [])
        : [];
    const wasteCollections = Array.isArray(campaign.wasteCollections)
        ? (campaign.wasteCollections ?? [])
        : [];
    const totalWasteUnits = wasteCollections.reduce((acc, row) => acc + (row?.unitQuantity ?? 0), 0);
    const totalWasteWeightKg = wasteCollections.reduce((acc, row) => {
        const w = Number(row?.actualWeightKg ?? 0);
        return acc + (Number.isFinite(w) ? w : 0);
    }, 0);
    res.json({
        id: campaign.id,
        title: campaign.title,
        description: campaign.description,
        meetingLocation: campaign.meetingLocation,
        meetingTime: campaign.meetingTime,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        status: campaign.status,
        organizer: campaign.organizer
            ? {
                id: campaign.organizer.id,
                name: campaign.organizer.name,
                email: campaign.organizer.email
            }
            : null,
        beaches: beaches.map((b) => ({
            id: b.id,
            name: b.name,
            latitude: b.latitude,
            longitude: b.longitude,
            district: b?.beachLocation?.district ?? null,
            municipality: b?.beachLocation?.municipality ?? null,
            parish: b?.beachLocation?.parish ?? null
        })),
        registrations: registrations.map((r) => ({
            id: r.id,
            role: r.role,
            status: r.status,
            attendance: r.attendance,
            createdAt: r.createdAt,
            user: r.user
                ? { id: r.user.id, name: r.user.name, email: r.user.email, phone: r.user.phone }
                : null
        })),
        comments: comments
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((c) => ({
            id: c.id,
            body: c.body,
            createdAt: c.createdAt,
            user: c.user ? { id: c.user.id, name: c.user.name } : null
        })),
        wasteCollections: wasteCollections.map((row) => ({
            id: row.id,
            unitQuantity: row.unitQuantity,
            actualWeightKg: row.actualWeightKg,
            createdAt: row.createdAt,
            beach: row.beach ? { id: row.beach.id, name: row.beach.name } : null,
            waste: row.waste ? { id: row.waste.id, name: row.waste.name } : null,
            recordedBy: row.recordedBy ? { id: row.recordedBy.id, name: row.recordedBy.name } : null
        })),
        metrics: {
            beachesCount: beaches.length,
            registrationsCount: registrations.length,
            commentsCount: comments.length,
            wasteCollectionsCount: wasteCollections.length,
            totalWasteUnits,
            totalWasteWeightKg: totalWasteWeightKg > 0 ? Number(totalWasteWeightKg.toFixed(3)) : 0
        }
    });
});
export default app;
