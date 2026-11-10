import { getDatabase } from "@netlify/database";
import { getUser } from "@netlify/identity";

export const db = getDatabase();
export const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
});
export const requireUser = async () => {
  const user = await getUser();
  return user?.id && user.email ? user : null;
};
export const isAdmin = (user) => {
  const roles = user?.roles || user?.appMetadata?.roles || user?.app_metadata?.roles || [];
  return Array.isArray(roles) && roles.some((role) => String(role).trim().toLowerCase() === "admin");
};
export const profileFor = (user) => {
  const metadata = user.userMetadata ?? user.user_metadata ?? {};
  return metadata.toolshareProfile ?? {};
};
export const validateProfile = (profile) =>
  ["firstName", "lastName", "address", "town", "postcode", "mobile"]
    .every((key) => typeof profile?.[key] === "string" && profile[key].trim().length > 0);
export function sumupConfig() {
  const apiKey = Netlify.env.get("SUMUP_API_KEY");
  const merchantCode = Netlify.env.get("SUMUP_MERCHANT_CODE");
  if (!apiKey || !merchantCode) throw new Error("SumUp configuration is incomplete");
  return { apiKey, merchantCode };
}

