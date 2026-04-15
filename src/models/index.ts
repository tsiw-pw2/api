export { sequelize } from "../config/sequelize.js"
export { User, type UserAttributes, type UserCreationAttributes } from "./user.model.js"
export {
  BeachLocation,
  type BeachLocationAttributes,
  type BeachLocationCreationAttributes
} from "./beach_location.model.js"
export { Beach, type BeachAttributes, type BeachCreationAttributes } from "./beach.model.js"
export {
  Campaign,
  type CampaignAttributes,
  type CampaignCreationAttributes
} from "./campaign.model.js"
export {
  WasteType,
  type WasteTypeAttributes,
  type WasteTypeCreationAttributes
} from "./waste_type.model.js"
export { Waste, type WasteAttributes, type WasteCreationAttributes } from "./waste.model.js"
export {
  CampaignBeach,
  type CampaignBeachAttributes,
  type CampaignBeachCreationAttributes
} from "./campaign_beach.model.js"
export {
  Registration,
  type RegistrationAttributes,
  type RegistrationCreationAttributes
} from "./registration.model.js"
export {
  Comment,
  type CommentAttributes,
  type CommentCreationAttributes
} from "./comment.model.js"
export {
  WasteCollection,
  type WasteCollectionAttributes,
  type WasteCollectionCreationAttributes
} from "./waste_collection.model.js"
