// Allowed Interplay Bucks redemption denominations (cents).
// Shared by the client picker and server validation (spec: IB_DENOMINATIONS_CENTS).
export const IB_DENOMINATIONS_CENTS = [
  2500,    // $25
  5000,    // $50
  10000,   // $100
  25000,   // $250
  50000,   // $500
  62500,   // $625 — Boulder Dojo Super Limited EB
  65000,   // $650 — Online Dojo GA
  67500,   // $675 — Boulder Dojo EB
  75000,   // $750 — Boulder Dojo GA
];

export const IB_DENOM_LABELS = {
  62500: "Boulder Dojo Super Limited EB",
  65000: "Online Dojo GA",
  67500: "Boulder Dojo EB",
  75000: "Boulder Dojo GA",
};
