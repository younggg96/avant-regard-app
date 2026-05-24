/** Backend user ID for the customer-service / admin account */
export const CS_USER_ID = 1;

export const APP_LOGO = require("../../assets/images/logo.jpg");

export function isCustomerServiceUser(userId?: number | null): boolean {
  return userId === CS_USER_ID;
}
